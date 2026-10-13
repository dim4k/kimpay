/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Create a Kimpay with its creator and other members, in one transaction.
//
// Created in several requests, a dropped connection could leave half a group:
// a Kimpay without its creator (`created_by` empty, which anyone holding the
// URL could then set, see 1735000000_harden_rules), or with some members only,
// duplicated when the offline queue replayed the whole creation.
//
// IDs are generated client-side (the Kimpay ID is its capability secret), so
// the call is idempotent: replaying a creation that already went through (only
// the response was lost) changes nothing.
//
// The creator is linked to the logged-in account, if any (never to a user id
// taken from the body), which also becomes the group's owner (allowed to
// delete it). A guest sends a creator key instead: only its hash is kept, and
// the device proves with it that it created the group once logged in (see
// /api/kimpay/{id}/own below).
// =============================================================================

routerAdd("POST", "/api/kimpay/create", (e) => {
    // Plain JS values (not Go maps / slices).
    const body = JSON.parse(JSON.stringify(e.requestInfo().body || {}));
    const isId = (v) => typeof v === "string" && /^[a-z0-9]{15}$/.test(v);
    const isMember = (p) => !!p && isId(p.id) && typeof p.name === "string" && p.name.trim() !== "";
    const isKey = (v) => typeof v === "string" && v.length >= 32 && v.length <= 128;
    const creator = body.creator;
    const others = Array.isArray(body.participants) ? body.participants : [];

    if (
        !isId(body.id) ||
        typeof body.name !== "string" ||
        typeof body.invite_token !== "string" ||
        !isMember(creator) ||
        !others.every(isMember) ||
        others.length > 49 || // expenses.involved holds 50 participants at most
        (body.owner_key != null && !isKey(body.owner_key))
    ) {
        return e.json(400, { message: "Invalid body" });
    }

    try {
        e.app.findRecordById("kimpays", body.id);
        return e.json(200, { id: body.id }); // Already created
    } catch (err) {
        // Not created yet
    }

    // No account needed: limited per IP, so a script cannot fill the database.
    const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
    if (!checkRateLimit(`kimpay_create_${e.realIP()}`, 30, 60 * 1000)) {
        return e.json(429, { message: "Too many requests. Please wait a minute." });
    }

    const userId = e.auth && e.auth.collection().name === "users" ? e.auth.id : "";

    // Field validation (required name, icon length...) runs on save: a
    // rejected record aborts the whole transaction.
    e.app.runInTransaction((txApp) => {
        const kimpays = txApp.findCollectionByNameOrId("kimpays");
        const participants = txApp.findCollectionByNameOrId("participants");

        const kimpay = new Record(kimpays);
        kimpay.set("id", body.id);
        kimpay.set("name", body.name);
        kimpay.set("icon", body.icon || "");
        kimpay.set("currency", body.currency || "");
        kimpay.set("invite_token", body.invite_token);
        if (userId) kimpay.set("owner", userId);
        else if (body.owner_key) kimpay.set("owner_key_hash", $security.sha256(body.owner_key));
        txApp.save(kimpay);

        [creator].concat(others).forEach((member, i) => {
            const participant = new Record(participants);
            participant.set("id", member.id);
            participant.set("name", member.name);
            participant.set("kimpay", body.id);
            if (i === 0 && userId) participant.set("user", userId);
            // The creator uses the group; the others are names until they open it.
            if (i === 0) participant.set("joined", true);
            txApp.save(participant);
        });

        // Once the creator exists (relation).
        kimpay.set("created_by", creator.id);
        txApp.save(kimpay);
    });

    return e.json(200, { id: body.id });
});

// =============================================================================
// Become the owner of a group created as a guest, with its creator key: the
// device that created it, once logged in. The key is single use.
// =============================================================================

routerAdd("POST", "/api/kimpay/{id}/own", (e) => {
    const id = String(e.request.pathValue("id") || "");
    const body = JSON.parse(JSON.stringify(e.requestInfo().body || {}));
    const forbidden = () => e.json(403, { message: "Forbidden" });
    if (!/^[a-zA-Z0-9]{15}$/.test(id) || typeof body.key !== "string" || body.key === "") {
        return e.json(400, { message: "Invalid body" });
    }

    let kimpay;
    try {
        kimpay = e.app.findRecordById("kimpays", id);
    } catch (err) {
        return e.json(404, { message: "Not found" });
    }

    const owner = kimpay.getString("owner");
    if (owner === e.auth.id) return e.json(200, { owner: owner });
    const hash = kimpay.getString("owner_key_hash");
    if (owner || !hash || !$security.equal(hash, $security.sha256(body.key))) return forbidden();

    kimpay.set("owner", e.auth.id);
    kimpay.set("owner_key_hash", "");
    e.app.save(kimpay);
    return e.json(200, { owner: e.auth.id });
}, $apis.requireAuth("users"));

// =============================================================================
// A Kimpay with all its participants and expenses (the group view).
//
// Replaces `getOne` + back-relation `expand`, which PocketBase caps at 1000
// records per relation: larger groups got a truncated list without any error
// (wrong balances and totals).
//
// SECURITY: it must expose nothing more than that expand did. A hook bypasses
// the API rules, so the collections' view rules are applied here to the Kimpay
// and to every child record (they follow any later change of those rules), and
// records are serialized like the API does (hidden fields left out). Only an ID
// is taken: no filter, no listing (the expenses listRule stays closed).
// =============================================================================

routerAdd("GET", "/api/kimpay/{id}/data", (e) => {
    const id = String(e.request.pathValue("id") || "");
    const notFound = () => e.json(404, { message: "Not found" });
    if (!/^[a-zA-Z0-9]{15}$/.test(id)) return notFound();

    let kimpay;
    try {
        kimpay = e.app.findRecordById("kimpays", id);
    } catch (err) {
        return notFound();
    }

    const info = e.requestInfo();
    const canView = (record) => {
        try {
            return e.app.canAccessRecord(record, info, record.collection().viewRule);
        } catch (err) {
            return false; // Invalid rule or db error: deny
        }
    };
    if (!canView(kimpay)) return notFound();

    const children = (collection, sort) => {
        const records = e.app.findRecordsByFilter(collection, "kimpay = {:id}", sort, 0, 0, { id: id });
        const visible = [];
        for (let i = 0; i < records.length; i++) {
            if (canView(records[i])) visible.push(records[i]);
        }
        return visible;
    };

    // Same shape as the expand it replaces (the `fields` query parameter
    // works too: PocketBase applies it to any JSON response).
    kimpay.setExpand({
        participants_via_kimpay: children("participants", "created"),
        expenses_via_kimpay: children("expenses", "-created"),
    });
    return e.json(200, kimpay);
});
