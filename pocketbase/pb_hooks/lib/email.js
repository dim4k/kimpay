/// <reference path="../../pb_data/types.d.ts" />

// =============================================================================
// Shared email helper for pb_hooks handlers.
//
// pb_hooks *.pb.js handlers run in isolated scopes, so common logic is shared
// by requiring this CommonJS module from inside a handler:
//
//   const { sendTemplatedEmail } = require(`${__hooks}/lib/email.js`);
//
// The module is stateless (pure functions only) to stay safe with the shared
// module registry. Global objects ($app, MailerMessage) are available here when
// the functions are invoked from a handler context.
// =============================================================================

/**
 * Find an email template by slug + locale, falling back to the English variant.
 * Returns the template record or null.
 */
function findTemplate(slug, locale) {
    var safeSlug = String(slug).replace(/'/g, "''");
    var safeLocale = typeof locale === "string" ? locale.replace(/'/g, "''") : "";

    try {
        var records = $app.findRecordsByFilter(
            "email_templates",
            "slug='" + safeSlug + "' && locale='" + safeLocale + "'",
        );
        if (records && records.length > 0) {
            return records[0];
        }

        var recordsEn = $app.findRecordsByFilter(
            "email_templates",
            "slug='" + safeSlug + "' && locale='en'",
        );
        if (recordsEn && recordsEn.length > 0) {
            return recordsEn[0];
        }
    } catch (e) {
        console.log("Error fetching template:", e);
    }

    return null;
}

/**
 * Replace all `{key}` placeholders in `str` with the matching value from `vars`.
 * Uses split/join to stay ES5-safe (no String.prototype.replaceAll).
 */
function applyVars(str, vars) {
    var result = str;
    for (var key in vars) {
        if (!Object.prototype.hasOwnProperty.call(vars, key)) continue;
        var value = vars[key] == null ? "" : String(vars[key]);
        result = result.split("{" + key + "}").join(value);
    }
    return result;
}

/**
 * Send a templated email.
 *
 * @param {object} opts
 * @param {string} opts.slug            - Email template slug.
 * @param {string} opts.locale          - Preferred template locale (falls back to "en").
 * @param {string} opts.to              - Recipient address.
 * @param {object} [opts.vars]          - `{key}` -> value replacements for subject/body.
 * @param {string} [opts.fallbackSubject] - Subject used when no template is found.
 * @param {string} [opts.fallbackHtml]    - HTML body used when no template is found.
 * @param {string} [opts.text]            - Optional plaintext override.
 */
function sendTemplatedEmail(opts) {
    var settings = $app.settings();
    var senderName = settings.meta.senderName || "Kimpay";
    var senderAddress = settings.meta.senderAddress || "no-reply@kimpay.io";

    var template = findTemplate(opts.slug, opts.locale);

    var subject = template
        ? template.get("subject")
        : opts.fallbackSubject || "";
    var html = template ? template.get("body") : opts.fallbackHtml || "";

    if (template) {
        var tSenderName = template.get("sender_name");
        var tSenderAddress = template.get("sender_address");
        if (tSenderName) senderName = tSenderName;
        if (tSenderAddress) senderAddress = tSenderAddress;
    }

    var vars = opts.vars || {};
    subject = applyVars(subject, vars);
    html = applyVars(html, vars);

    var text =
        opts.text != null ? opts.text : subject + "\n\n" + (vars.url || "");

    var message = new MailerMessage({
        from: { address: senderAddress, name: senderName },
        to: [{ address: opts.to }],
        subject: subject,
        html: html,
        text: text,
    });

    $app.newMailClient().send(message);
}

/**
 * Create a single-use magic-link OTP for `user` and email it to them.
 *
 * Generates a 64-char code stored in `auth_otps` (24h expiry), builds the
 * login URL `${origin}/?code=...`, and sends the `login_magic_link` template.
 * Shared by /api/login/magic-link and /api/register to avoid duplication.
 *
 * @param {object} opts
 * @param {Record} opts.user    - The target auth user record.
 * @param {string} opts.email   - Recipient address.
 * @param {string} opts.name    - Display name used in the email.
 * @param {string} opts.locale  - Preferred template locale.
 * @param {string} opts.origin  - Request origin (e.g. https://kimpay.io).
 * @param {string} [opts.fallbackSubject] - Subject when no template is found.
 */
function createOtpAndSendMagicLink(opts) {
    var code = $security.randomString(64);
    var otps = $app.findCollectionByNameOrId("auth_otps");
    var otpRecord = new Record(otps);
    otpRecord.set("code", code);
    otpRecord.set("user", opts.user.id);

    // Expiration: 24 hours (PocketBase date format "YYYY-MM-DD HH:MM:SS").
    var expires = new Date();
    expires.setDate(expires.getDate() + 1);
    otpRecord.set("expires", expires.toISOString().replace("T", " ").replace("Z", ""));

    $app.save(otpRecord);

    var cleanOrigin = opts.origin.endsWith("/")
        ? opts.origin.slice(0, -1)
        : opts.origin;
    var url = cleanOrigin + "/?code=" + code;

    sendTemplatedEmail({
        slug: "login_magic_link",
        locale: opts.locale,
        to: opts.email,
        vars: { url: url, name: opts.name || "User" },
        fallbackSubject: opts.fallbackSubject || "Login to Kimpay",
        fallbackHtml: '<a href="' + url + '">Login</a>',
    });
}

module.exports = {
    sendTemplatedEmail: sendTemplatedEmail,
    createOtpAndSendMagicLink: createOtpAndSendMagicLink,
};
