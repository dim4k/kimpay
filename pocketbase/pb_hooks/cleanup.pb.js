/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Scheduled cleanup of expired magic-link OTPs.
//
// `auth_otps` records are intentionally kept valid until they expire (a single
// magic link is often opened several times — mail webview, then real browser).
// They are never deleted on use, so without a sweep the table grows forever.
//
// This cron purges every OTP whose `expires` timestamp is in the past, once an
// hour. PocketBase stores dates as "YYYY-MM-DD HH:MM:SS.SSSZ"; we compare with
// the same formatting used when the OTP is created (see lib/email.js).
// =============================================================================

cronAdd("purge_expired_otps", "0 * * * *", () => {
    try {
        const nowStr = new Date()
            .toISOString()
            .replace("T", " ")
            .replace("Z", "");

        const expired = $app.findRecordsByFilter(
            "auth_otps",
            `expires < '${nowStr}'`,
        );

        for (const otp of expired) {
            try {
                $app.delete(otp);
            } catch (err) {
                // Record may have been removed concurrently; ignore.
            }
        }
    } catch (e) {
        console.error("OTP purge failed");
    }
});
