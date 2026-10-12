/// <reference path="../../pb_data/types.d.ts" />

// =============================================================================
// Shared rate-limit helper for pb_hooks handlers.
//
// pb_hooks *.pb.js handlers run in isolated scopes, so this common logic is
// shared by requiring this CommonJS module from inside a handler:
//
//   const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
//   if (!checkRateLimit("share_" + clientIp, 5, 60 * 1000)) {
//       return c.json(429, { message: "Too many requests. Please wait a minute." });
//   }
//
// State is kept in the in-memory app store ($app.store()), using a fixed-window
// counter per key. The module is stateless itself (pure function over the
// store), so it is safe with the shared module registry.
//
// RATE_LIMIT_MULTIPLIER (env, default 1) scales every limit: the e2e stack
// runs all its browsers from one IP.
// =============================================================================

/**
 * Fixed-window rate limiter.
 *
 * @param {string} key       - Unique bucket key (e.g. "ocr_rate_" + userId).
 * @param {number} maxHits   - Max allowed hits within the window.
 * @param {number} windowMs  - Window length in milliseconds.
 * @param {number} [cost=1]  - What this hit counts for (e.g. bytes uploaded).
 * @returns {boolean} true if the request is allowed, false if the limit is hit.
 */
function checkRateLimit(key, maxHits, windowMs, cost) {
    var now = Date.now();
    var amount = cost || 1;
    var limit = maxHits * (Number($os.getenv("RATE_LIMIT_MULTIPLIER")) || 1);

    var data = $app.store().get(key);
    if (!data || typeof data !== "object") {
        data = { windowStart: now, count: 0 };
    }
    if (now - data.windowStart > windowMs) {
        data = { windowStart: now, count: 0 };
    }

    if (data.count + amount > limit) {
        // Persist so the window keeps sliding correctly on the next call.
        $app.store().set(key, data);
        return false;
    }

    data.count += amount;
    $app.store().set(key, data);
    return true;
}

module.exports = {
    checkRateLimit: checkRateLimit,
};
