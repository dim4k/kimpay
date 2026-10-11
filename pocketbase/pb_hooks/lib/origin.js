/// <reference path="../../pb_data/types.d.ts" />

// =============================================================================
// App origin allowlist.
//
// Links emailed by the server (magic links, share links) must NEVER point to
// an origin chosen by the caller: an attacker could otherwise make the server
// send a genuine Kimpay email carrying a valid login code to a site they own.
//
// Allowed origins come from (in order):
//   1. the APP_ORIGINS env var (comma-separated, first one is the default),
//   2. the PocketBase "Application URL" setting (Settings > Application),
//   3. https://app.kimpay.io as a last resort.
// Loopback origins (localhost / 127.0.0.1, any port) are always accepted so
// local dev works: a link pointing to the victim's own machine leaks nothing.
//
//   const { resolveAppOrigin } = require(`${__hooks}/lib/origin.js`);
// =============================================================================

var DEFAULT_ORIGIN = "https://app.kimpay.io";
var LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/** Extract the `scheme://host[:port]` part of a URL, or "" if invalid. */
function originOf(url) {
    var match = /^(https?:\/\/[^\/?#\s]+)/i.exec(String(url || "").trim());
    return match ? match[1].toLowerCase() : "";
}

function allowedOrigins() {
    var list = [];
    var env = $os.getenv("APP_ORIGINS");
    if (env) {
        env.split(",").forEach(function (o) {
            var origin = originOf(o);
            if (origin) list.push(origin);
        });
    }
    // Ignore PocketBase's default "http://localhost:8090" (setting left unset).
    var appURL = originOf($app.settings().meta.appURL);
    if (appURL && !LOOPBACK.test(appURL)) list.push(appURL);
    list.push(DEFAULT_ORIGIN);
    return list;
}

function isAllowedOrigin(url) {
    var origin = originOf(url);
    if (!origin) return false;
    return LOOPBACK.test(origin) || allowedOrigins().indexOf(origin) !== -1;
}

/**
 * Returns the requested origin when it is allowed, otherwise the default app
 * origin. Never returns a caller-controlled, non-allowlisted origin.
 */
function resolveAppOrigin(requested) {
    return isAllowedOrigin(requested) ? originOf(requested) : allowedOrigins()[0];
}

module.exports = {
    isAllowedOrigin: isAllowedOrigin,
    resolveAppOrigin: resolveAppOrigin,
};
