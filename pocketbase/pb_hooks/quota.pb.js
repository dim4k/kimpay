/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Upload quota on the files sent without an account: expense photos and
// participant avatars (see lib/quota.js). Checked before the record is saved.
// =============================================================================

onRecordCreateRequest((e) => {
    const { checkUploadQuota } = require(`${__hooks}/lib/quota.js`);
    checkUploadQuota(e, ["photos"]);
    e.next();
}, "expenses");

onRecordUpdateRequest((e) => {
    const { checkUploadQuota } = require(`${__hooks}/lib/quota.js`);
    checkUploadQuota(e, ["photos"]);
    e.next();
}, "expenses");

onRecordCreateRequest((e) => {
    const { checkUploadQuota } = require(`${__hooks}/lib/quota.js`);
    checkUploadQuota(e, ["avatar"]);
    e.next();
}, "participants");

onRecordUpdateRequest((e) => {
    const { checkUploadQuota } = require(`${__hooks}/lib/quota.js`);
    checkUploadQuota(e, ["avatar"]);
    e.next();
}, "participants");
