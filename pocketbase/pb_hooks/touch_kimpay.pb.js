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
// See lib/touch.js.
// =============================================================================

onRecordAfterCreateSuccess((e) => {
    const { touchKimpay } = require(`${__hooks}/lib/touch.js`);
    touchKimpay(e.app, e.record.get("kimpay"));
    e.next();
}, "expenses", "participants");

onRecordAfterUpdateSuccess((e) => {
    const { touchKimpay } = require(`${__hooks}/lib/touch.js`);
    const kimpayId = e.record.get("kimpay");
    touchKimpay(e.app, kimpayId);

    // A record moved to another Kimpay must also disappear from the old one.
    const previousId = e.record.original().get("kimpay");
    if (previousId && previousId !== kimpayId) touchKimpay(e.app, previousId);

    e.next();
}, "expenses", "participants");

onRecordAfterDeleteSuccess((e) => {
    const { touchKimpay } = require(`${__hooks}/lib/touch.js`);
    touchKimpay(e.app, e.record.get("kimpay"));
    e.next();
}, "expenses", "participants");
