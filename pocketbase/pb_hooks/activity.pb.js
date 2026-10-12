/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// The history of a group: every change to its expenses and members made
// through the API is logged once it succeeded (see lib/activity.js), with the
// participant who made it (header sent by the app, checked against the group).
//
// Changes made by other hooks (group creation, merge) go through `txApp` and
// are not seen here: the merge route logs its own line.
// =============================================================================

// --- Expenses ---------------------------------------------------------------

onRecordCreateRequest((e) => {
    const activity = require(`${__hooks}/lib/activity.js`);
    e.next();

    const record = e.record;
    const kimpayId = record.getString("kimpay");
    const actor = activity.actorOf(e, kimpayId, record.getString("created_by"));
    const data = activity.expenseData(e.app, record);
    if (record.getBool("is_reimbursement")) {
        activity.log(e.app, kimpayId, "reimbursement_created", actor, record.id, data);
    } else {
        activity.log(e.app, kimpayId, "expense_created", actor, record.id, data);
    }
}, "expenses");

onRecordUpdateRequest((e) => {
    const activity = require(`${__hooks}/lib/activity.js`);
    const kimpayId = e.record.getString("kimpay");
    const actor = activity.actorOf(e, kimpayId);
    const before = activity.expenseData(e.app, e.record.original());
    e.next();

    const after = activity.expenseData(e.app, e.record);
    const changed = activity.changedKeys(before, after);
    if (changed.length === 0) return;
    activity.log(e.app, kimpayId, "expense_updated", actor, e.record.id, {
        description: after.description,
        icon: after.icon,
        amount: after.amount,
        currency: after.currency,
        changed: changed,
        before: before,
        after: after,
    });
}, "expenses");

onRecordDeleteRequest((e) => {
    const activity = require(`${__hooks}/lib/activity.js`);
    const record = e.record;
    const kimpayId = record.getString("kimpay");
    const actor = activity.actorOf(e, kimpayId);
    const data = activity.expenseData(e.app, record);
    const reimbursement = record.getBool("is_reimbursement");
    e.next();

    activity.log(e.app, kimpayId, reimbursement ? "reimbursement_deleted" : "expense_deleted", actor, record.id, data);
}, "expenses");

// --- Members ----------------------------------------------------------------

onRecordCreateRequest((e) => {
    const activity = require(`${__hooks}/lib/activity.js`);
    e.next();

    const kimpayId = e.record.getString("kimpay");
    const actor = activity.actorOf(e, kimpayId);
    activity.log(e.app, kimpayId, "participant_added", actor, e.record.id, { name: e.record.getString("name") });
}, "participants");

onRecordUpdateRequest((e) => {
    const activity = require(`${__hooks}/lib/activity.js`);
    const kimpayId = e.record.getString("kimpay");
    const actor = activity.actorOf(e, kimpayId);
    const original = e.record.original();
    const before = original.getString("name");
    const handles = (record) => ({ paypal: record.getString("paypal"), revolut: record.getString("revolut") });
    const handlesBefore = handles(original);
    e.next();

    // Photos, accounts: not part of the history.
    const after = e.record.getString("name");
    if (after !== before) {
        activity.log(e.app, kimpayId, "participant_renamed", actor, e.record.id, { from: before, to: after });
    }

    // Payment links: where the others send money, so any change shows.
    // { name, paypal: { from, to } } with the services changed only.
    const handlesAfter = handles(e.record);
    const changed = activity.changedKeys(handlesBefore, handlesAfter);
    if (changed.length > 0) {
        const data = { name: after };
        changed.forEach((service) => (data[service] = { from: handlesBefore[service], to: handlesAfter[service] }));
        activity.log(e.app, kimpayId, "participant_payment_changed", actor, e.record.id, data);
    }
}, "participants");

onRecordDeleteRequest((e) => {
    const activity = require(`${__hooks}/lib/activity.js`);
    const kimpayId = e.record.getString("kimpay");
    const actor = activity.actorOf(e, kimpayId);
    const name = e.record.getString("name");
    e.next();

    activity.log(e.app, kimpayId, "participant_deleted", actor, e.record.id, { name: name });
}, "participants");

// =============================================================================
// GET /api/kimpay/{id}/activity: the latest lines of a group's history.
//
// SECURITY: same access as the group itself (its view rule, applied here like
// in /api/kimpay/{id}/data); `activities` has no API rule of its own.
// =============================================================================

routerAdd("GET", "/api/kimpay/{id}/activity", (e) => {
    const id = String(e.request.pathValue("id") || "");
    const notFound = () => e.json(404, { message: "Not found" });
    if (!/^[a-zA-Z0-9]{15}$/.test(id)) return notFound();

    let kimpay;
    try {
        kimpay = e.app.findRecordById("kimpays", id);
    } catch (err) {
        return notFound();
    }
    try {
        if (!e.app.canAccessRecord(kimpay, e.requestInfo(), kimpay.collection().viewRule)) return notFound();
    } catch (err) {
        return notFound();
    }

    const records = e.app.findRecordsByFilter("activities", "kimpay = {:id}", "-created", 200, 0, { id: id });
    return e.json(200, records);
});
