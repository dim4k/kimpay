/// <reference path="../../pb_data/types.d.ts" />

// =============================================================================
// Upload quota: photos and avatars can be sent without an account, so a
// script could fill the disk. Each IP gets a budget of bytes per hour.
//
//   const { checkUploadQuota } = require(`${__hooks}/lib/quota.js`);
// =============================================================================

var UPLOAD_BUDGET = 300 * 1024 * 1024; // bytes per IP...
var UPLOAD_WINDOW = 60 * 60 * 1000; // ...per hour

/**
 * Throws a 429 when the files of this request go past the IP's budget.
 *
 * @param {core.RecordRequestEvent} e
 * @param {string[]} fields file fields of the record
 */
function checkUploadQuota(e, fields) {
    var bytes = 0;
    for (var i = 0; i < fields.length; i++) {
        var files = e.record.getUnsavedFiles(fields[i]);
        for (var j = 0; j < files.length; j++) {
            if (files[j]) bytes += files[j].size;
        }
    }
    if (bytes === 0) return;

    var rateLimit = require(`${__hooks}/lib/rateLimit.js`);
    if (!rateLimit.checkRateLimit("upload_" + e.realIP(), UPLOAD_BUDGET, UPLOAD_WINDOW, bytes)) {
        throw new TooManyRequestsError("Upload quota exceeded. Please try again later.");
    }
}

module.exports = {
    checkUploadQuota: checkUploadQuota,
};
