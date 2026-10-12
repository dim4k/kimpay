// =============================================================================
// Authentication (Magic Links, Registration, OTP Verification)
// =============================================================================

routerAdd("POST", "/api/login/magic-link", (c) => {
    try {
        const data = new DynamicModel({
            email: "",
            locale: "",
            url: "",
        });

        try {
            c.bindBody(data);
        } catch (err) {
            return c.json(400, { message: "Invalid JSON body" });
        }

        const email = data.email;
        const locale = data.locale || "en";

        if (!email) {
            return c.json(400, { message: "Missing email" });
        }

        // Rate limiting: per IP, and per target address so the endpoint cannot
        // be used to flood a given mailbox.
        const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
        if (
            !checkRateLimit(`magic_ip_${c.realIP()}`, 10, 60 * 1000) ||
            !checkRateLimit(`magic_mail_${email.toLowerCase()}`, 3, 10 * 60 * 1000)
        ) {
            return c.json(429, {
                message: "Too many requests. Please wait a minute.",
            });
        }

        // The link origin is taken from an allowlist, never trusted as-is.
        const { resolveAppOrigin } = require(`${__hooks}/lib/origin.js`);
        const origin = resolveAppOrigin(data.url);

        // Look up the user. To avoid email enumeration, we ALWAYS respond 200
        // regardless of whether the account exists; the email is only sent when
        // a matching user is found.
        let user = null;
        try {
            user = $app.findAuthRecordByEmail("users", email);
        } catch (e) {
            user = null;
        }

        if (user) {
            const { createOtpAndSendMagicLink } = require(`${__hooks}/lib/email.js`);
            createOtpAndSendMagicLink({
                user: user,
                email: email,
                name: user.get("name") || "User",
                locale: locale,
                origin: origin,
                fallbackSubject: "Login to Kimpay",
            });
        }

        return c.json(200, { success: true });
    } catch (e) {
        console.error("Magic Link Error");
        return c.json(500, { message: "Internal server error" });
    }
});

routerAdd("POST", "/api/register", (c) => {
    try {
        const data = new DynamicModel({
            email: "",
            name: "",
            locale: "",
            url: "",
            participantId: "",
        });

        try {
            c.bindBody(data);
        } catch (err) {
            return c.json(400, { message: "Invalid JSON body" });
        }

        const email = data.email;
        const name = data.name;
        const locale = data.locale || "en";
        const participantId = data.participantId;

        if (!email || !name) {
            return c.json(400, { message: "Missing email or name" });
        }

        const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
        if (
            !checkRateLimit(`register_ip_${c.realIP()}`, 5, 60 * 1000) ||
            !checkRateLimit(`magic_mail_${email.toLowerCase()}`, 3, 10 * 60 * 1000)
        ) {
            return c.json(429, {
                message: "Too many requests. Please wait a minute.",
            });
        }

        // The link origin is taken from an allowlist, never trusted as-is.
        const { resolveAppOrigin } = require(`${__hooks}/lib/origin.js`);
        const origin = resolveAppOrigin(data.url);
        const { createOtpAndSendMagicLink } = require(`${__hooks}/lib/email.js`);

        // 1. An account already exists: send it a login link, and answer like
        // for a new one (the response must not tell which emails have an
        // account). Its name and participants are left as they are.
        let existingUser = null;
        try {
            existingUser = $app.findAuthRecordByEmail("users", email);
        } catch (e) {
            // User does not exist, proceed
        }
        if (existingUser) {
            createOtpAndSendMagicLink({
                user: existingUser,
                email: email,
                name: existingUser.get("name") || name,
                locale: locale,
                origin: origin,
                fallbackSubject: "Login to Kimpay",
            });
            return c.json(200, { success: true });
        }

        // 2. Create User
        const users = $app.findCollectionByNameOrId("users");
        const user = new Record(users);
        user.setEmail(email);
        const generatedPassword = $security.randomString(20);
        user.setPassword(generatedPassword);
        user.setVerified(true);
        user.set("name", name);

        $app.save(user); // Save to get ID

        // 3. Link Participant if provided
        if (participantId) {
            try {
                const participant = $app.findRecordById(
                    "participants",
                    participantId,
                );
                if (!participant.get("user")) {
                    participant.set("user", user.id);
                    $app.save(participant);
                }
            } catch (e) {
                console.log("Error linking participant during registration");
            }
        }

        // 4. Send the magic link so the new user can log in.
        createOtpAndSendMagicLink({
            user: user,
            email: email,
            name: name,
            locale: locale,
            origin: origin,
            fallbackSubject: "Welcome to Kimpay",
        });

        return c.json(200, { success: true });
    } catch (e) {
        console.error("Register Error");
        return c.json(500, { message: "Internal server error" });
    }
});

routerAdd("POST", "/api/login/verify", (c) => {
    try {
        const data = new DynamicModel({
            code: "",
        });

        try {
            c.bindBody(data);
        } catch (err) {
            return c.json(400, { message: "Invalid JSON body" });
        }

        if (!data.code) {
            return c.json(400, { message: "Missing code" });
        }

        // Rate limiting: 10 attempts per minute per IP
        const clientIp = c.realIP();
        const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
        if (!checkRateLimit(`otp_verify_${clientIp}`, 10, 60 * 1000)) {
            return c.json(429, {
                message: "Too many attempts. Please wait a minute.",
            });
        }

        // Find a valid OTP: not expired, and not opened more than a few
        // minutes ago. Only the code's hash is stored. Bound params: no
        // manual escaping.
        //
        // Note: OTP is NOT deleted on first use. A single magic link is
        // frequently opened more than once for the same click (e.g. first in
        // the mail client's in-app webview, then again in the real
        // browser/PWA): deleting it breaks those subsequent loads with
        // "Invalid Link". It stays valid a few minutes after the first one.
        const GRACE_MS = 5 * 60 * 1000;
        const dbDate = (ms) => new Date(ms).toISOString().replace("T", " ");
        try {
            let otp;
            try {
                otp = $app.findFirstRecordByFilter(
                    "auth_otps",
                    "code = {:code} && expires >= @now && (used = '' || used >= {:since})",
                    { code: $security.sha256(String(data.code)), since: dbDate(Date.now() - GRACE_MS) },
                );
            } catch (e) {
                return c.json(400, { message: "Invalid or expired code" });
            }

            const user = $app.findRecordById("users", otp.get("user"));

            if (!otp.getString("used")) {
                otp.set("used", dbDate(Date.now()));
                $app.save(otp);
            }
            // Links requested before (or after) this one stop working.
            $app.db()
                .newQuery("DELETE FROM auth_otps WHERE user = {:user} AND id != {:id}")
                .bind({ user: user.id, id: otp.id })
                .execute();

            // Standard auth response ({ token, record, meta }): serializes the
            // record like any PocketBase login (email included for its owner)
            // and runs the OnRecordAuthRequest hooks.
            return $apis.recordAuthResponse(c, user, "magic_link");
        } catch (e) {
            console.log("OTP Verify Error:", e);
            return c.json(400, { message: "Invalid code or internal error" });
        }
    } catch (e) {
        console.error("Verify Error:", e);
        return c.json(500, { message: "Internal server error" });
    }
});
