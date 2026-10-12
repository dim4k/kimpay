/// <reference path="../../pb_data/types.d.ts" />

// =============================================================================
// The history of a group (`activities` collection): helpers for the hooks.
//
//   const activity = require(`${__hooks}/lib/activity.js`);
//
// Nothing here ever throws: the history must never fail (or block) the
// change it follows. A missing line is only logged as a warning.
// =============================================================================

// "X-Kimpay-Participant", as requestInfo() names headers (lowercase, "_").
var ACTOR_HEADER = "x_kimpay_participant";

/**
 * Who makes the request: the participant the app sends in its header, when
 * it belongs to that Kimpay (anything else is ignored).
 *
 * @param {core.RequestEvent} e
 * @param {string} kimpayId
 * @param {string} [fallbackId] e.g. the `created_by` of a new expense
 * @returns {{ id: string, name: string }}
 */
function actorOf(e, kimpayId, fallbackId) {
    var headers = {};
    try {
        headers = e.requestInfo().headers || {};
    } catch (err) {
        // No request info: only the fallback
    }
    var candidates = [String(headers[ACTOR_HEADER] || ""), String(fallbackId || "")];
    for (var i = 0; i < candidates.length; i++) {
        var id = candidates[i];
        if (!/^[a-z0-9]{15}$/.test(id)) continue;
        try {
            var participant = e.app.findRecordById("participants", id);
            if (participant.getString("kimpay") === kimpayId) {
                return { id: id, name: participant.getString("name") };
            }
        } catch (err) {
            // Unknown participant
        }
    }
    return { id: "", name: "" };
}

/** Names of participants (at this time), in order; unknown ones left out. */
function namesOf(app, ids) {
    var names = [];
    for (var i = 0; i < ids.length; i++) {
        try {
            names.push(app.findRecordById("participants", ids[i]).getString("name"));
        } catch (err) {
            // Deleted
        }
    }
    return names;
}

/**
 * What an expense line of the history shows, and what an update compares.
 *
 * @param {core.App} app
 * @param {core.Record} record
 */
function expenseData(app, record) {
    try {
        return readExpense(app, record);
    } catch (err) {
        app.logger().warn("activity: expense not read", "error", String(err));
        return {};
    }
}

function readExpense(app, record) {
    var split = null;
    try {
        split = JSON.parse(record.getString("split") || "null");
    } catch (err) {
        split = null;
    }
    return {
        description: record.getString("description"),
        icon: record.getString("icon"),
        amount: record.getFloat("amount"),
        currency: record.getString("currency"),
        date: record.getString("date").slice(0, 10),
        payer: namesOf(app, [record.getString("payer")])[0] || "",
        involved: namesOf(app, record.getStringSlice("involved")),
        split: (split && split.mode) || "equal",
        income: record.getBool("is_income"),
        photos: record.getStringSlice("photos").length,
    };
}

/** The keys whose values differ (compared as JSON). */
function changedKeys(before, after) {
    var keys = [];
    for (var key in after) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) keys.push(key);
    }
    return keys;
}

/**
 * Add a line to the history of a Kimpay.
 *
 * @param {core.App} app
 * @param {string} kimpayId
 * @param {string} action one of the `action` values of `activities`
 * @param {{ id: string, name: string }} actor
 * @param {string} target expense or participant ID
 * @param {object} data
 */
function log(app, kimpayId, action, actor, target, data) {
    try {
        var record = new Record(app.findCollectionByNameOrId("activities"));
        record.set("kimpay", kimpayId);
        record.set("action", action);
        record.set("actor", actor.id);
        record.set("actor_name", String(actor.name || "").slice(0, 64));
        record.set("target", target || "");
        record.set("data", data);
        app.save(record);
    } catch (err) {
        app.logger().warn("activity: not logged", "action", action, "kimpayId", kimpayId, "error", String(err));
    }
}

module.exports = {
    actorOf: actorOf,
    expenseData: expenseData,
    changedKeys: changedKeys,
    log: log,
};
