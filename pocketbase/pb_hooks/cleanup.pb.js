/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Scheduled cleanup of expired magic-link OTPs.
//
// `auth_otps` records are intentionally kept valid until they expire (a single
// magic link is often opened several times — mail webview, then real browser).
// They are never deleted on use, so without a sweep the table grows forever.
//
// This cron purges every OTP whose `expires` timestamp is in the past, once an
// hour, in a single statement (no hooks are attached to `auth_otps`).
// Dates are stored as "YYYY-MM-DD HH:MM:SS.SSSZ", like strftime() below.
// =============================================================================

cronAdd("purge_expired_otps", "0 * * * *", () => {
    try {
        $app.db()
            .newQuery("DELETE FROM auth_otps WHERE expires < strftime('%Y-%m-%d %H:%M:%fZ', 'now')")
            .execute();
    } catch (e) {
        console.error("OTP purge failed");
    }
});
