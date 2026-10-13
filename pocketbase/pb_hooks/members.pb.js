/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// What a member counts for in new expenses, set by anyone in the group:
// - inactive: no longer ticked by default (left the trip early)
// - default_shares: shares by default (a couple counting as 2), 1 to 20
//
// Changes nothing to the expenses already there. Logged in the history
// (participant_defaults_changed, the changed values only).
//
// SECURITY: a hook bypasses the API rules. Anyone who may edit the group
// (its update rule, like /api/kimpay/{id}/currency) may set these two fields,
// also on a member linked to an account: they say how the group splits, not
// who that person is. The updateRule keeps every other field to its owner and
// refuses these two outside this route.
// =============================================================================

routerAdd("POST", "/api/kimpay/{id}/participants/{pid}/defaults", (e) => {
    const id = String(e.request.pathValue("id") || "");
    const pid = String(e.request.pathValue("pid") || "");
    const body = JSON.parse(JSON.stringify(e.requestInfo().body || {}));
    const notFound = () => e.json(404, { message: "Not found" });
    const forbidden = () => e.json(403, { message: "Forbidden" });

    const hasInactive = body.inactive !== undefined;
    const hasShares = body.default_shares !== undefined;
    const shares = Number(body.default_shares);
    if (
        !/^[a-zA-Z0-9]{15}$/.test(id) ||
        !/^[a-z0-9]{15}$/.test(pid) ||
        (!hasInactive && !hasShares) ||
        (hasInactive && typeof body.inactive !== "boolean") ||
        (hasShares && !(Number.isInteger(shares) && shares >= 1 && shares <= 20))
    ) {
        return e.json(400, { message: "Invalid body" });
    }

    let kimpay, participant;
    try {
        kimpay = e.app.findRecordById("kimpays", id);
        participant = e.app.findRecordById("participants", pid);
    } catch (err) {
        return notFound();
    }
    if (participant.getString("kimpay") !== id) return notFound();

    const info = e.requestInfo();
    const allowed = (record, rule) => {
        try {
            return e.app.canAccessRecord(record, info, rule);
        } catch (err) {
            return false; // Invalid rule or db error: deny
        }
    };
    if (!allowed(kimpay, kimpay.collection().viewRule)) return notFound();
    if (!allowed(kimpay, kimpay.collection().updateRule)) return forbidden();

    // 0 (never set) reads as 1.
    const before = {
        inactive: participant.getBool("inactive"),
        default_shares: participant.getInt("default_shares") || 1,
    };
    const after = {
        inactive: hasInactive ? body.inactive : before.inactive,
        default_shares: hasShares ? shares : before.default_shares,
    };

    const activity = require(`${__hooks}/lib/activity.js`);
    const changed = activity.changedKeys(before, after);
    if (changed.length === 0) return e.json(200, after);

    participant.set("inactive", after.inactive);
    participant.set("default_shares", after.default_shares);
    e.app.save(participant);

    // { name, inactive: { from, to } } with the values changed only.
    const data = { name: participant.getString("name") };
    changed.forEach((key) => (data[key] = { from: before[key], to: after[key] }));
    activity.log(e.app, id, "participant_defaults_changed", activity.actorOf(e, id), pid, data);
    return e.json(200, after);
});
