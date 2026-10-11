/// <reference path="../../pb_data/types.d.ts" />

// =============================================================================
// Re-save ("touch") a parent Kimpay so PocketBase emits a realtime `update`
// event on `kimpays/{id}`; single-record subscribers then re-fetch the group.
//
//   const { touchKimpay } = require(`${__hooks}/lib/touch.js`);
// =============================================================================

/**
 * @param {core.App} app
 * @param {string} kimpayId
 */
function touchKimpay(app, kimpayId) {
    if (!kimpayId) return;

    var kimpay;
    try {
        kimpay = app.findRecordById("kimpays", kimpayId);
    } catch (err) {
        // Parent deleted (e.g. cascade delete): nobody left to notify.
        return;
    }

    try {
        app.save(kimpay);
    } catch (err) {
        // The child change is already committed: without this event clients
        // stay stale until they reload, so make the failure visible.
        app.logger().warn("touchKimpay: failed to notify kimpay", "kimpayId", kimpayId, "error", String(err));
    }
}

module.exports = {
    touchKimpay: touchKimpay,
};
