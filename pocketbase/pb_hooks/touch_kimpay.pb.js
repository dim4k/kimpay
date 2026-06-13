/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Touch parent Kimpay on expense/participant changes.
//
// Guests access a Kimpay by its UUID (capability URL): they read via
// `getOne` + `expand` (ViewRule) and subscribe in realtime to the single
// `kimpays/{id}` record (ViewRule). They never need an open `listRule`.
//
// To propagate child changes (expenses/participants) to those single-record
// subscribers, we re-save ("touch") the parent Kimpay so PocketBase emits a
// realtime update event for `kimpays/{id}`. The client then re-fetches.
//
// NOTE: PocketBase serializes each hook handler into its own isolated scope,
// so helper functions declared at module top-level are NOT available inside
// the handler. The touch logic is therefore inlined in each handler.
// We use the event's app (`e.app`) so the save enlists in the current
// transaction context.
// =============================================================================

onRecordAfterCreateSuccess((e) => {
    const kimpayId = e.record.get("kimpay");
    if (kimpayId) {
        try {
            e.app.save(e.app.findRecordById("kimpays", kimpayId));
        } catch (err) {
            // Parent may be mid cascade-delete; nothing to notify.
        }
    }
    e.next();
}, "expenses", "participants");

onRecordAfterUpdateSuccess((e) => {
    const kimpayId = e.record.get("kimpay");
    if (kimpayId) {
        try {
            e.app.save(e.app.findRecordById("kimpays", kimpayId));
        } catch (err) {
            // Parent may be mid cascade-delete; nothing to notify.
        }
    }
    e.next();
}, "expenses", "participants");

onRecordAfterDeleteSuccess((e) => {
    const kimpayId = e.record.get("kimpay");
    if (kimpayId) {
        try {
            e.app.save(e.app.findRecordById("kimpays", kimpayId));
        } catch (err) {
            // Parent itself may have been deleted (cascade); nothing to notify.
        }
    }
    e.next();
}, "expenses", "participants");

