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
            return c.json(400, {
                message: "Invalid JSON body",
                error: err.message,
            });
        }

        const email = data.email;
        const locale = data.locale || "en";

        if (!email) {
            return c.json(400, { message: "Missing email" });
        }

        // Construct URL origin (required to build the magic link).
        const origin = data.url;
        if (!origin || origin.trim() === "") {
            return c.json(400, { message: "Missing url origin" });
        }

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
            return c.json(400, {
                message: "Invalid JSON body",
                error: err.message,
            });
        }

        const email = data.email;
        const name = data.name;
        const locale = data.locale || "en";
        const participantId = data.participantId;

        if (!email || !name) {
            return c.json(400, { message: "Missing email or name" });
        }

        // 1. Check if user exists
        try {
            const existingUser = $app.findAuthRecordByEmail("users", email);
            if (existingUser) {
                return c.json(409, { message: "User already exists" });
            }
        } catch (e) {
            // User does not exist, proceed
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
        const origin = data.url;
        if (!origin || origin.trim() === "") {
            // User created but we can't build a login link without an origin.
            return c.json(200, {
                success: true,
                message: "User created but URL missing for magic link",
            });
        }

        const { createOtpAndSendMagicLink } = require(`${__hooks}/lib/email.js`);
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
            return c.json(400, {
                message: "Invalid JSON body",
                error: err.message,
            });
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

        // Find OTP
        try {
            // Need to filter by code AND expiration > NOW
            // PocketBase SQL format for dates: YYYY-MM-DD HH:MM:SS.SSSZ
            const nowStr = new Date()
                .toISOString()
                .replace("T", " ")
                .replace("Z", "");

            // Sanitize for PocketBase filter strings (prevent injection).
            // Defined locally because pb_hooks handlers run in isolated scope.
            const safeCode =
                typeof data.code === "string"
                    ? data.code.replace(/'/g, "''")
                    : "";
            const otps = $app.findRecordsByFilter(
                "auth_otps",
                `code='${safeCode}' && expires >= '${nowStr}'`,
            );

            if (!otps || otps.length === 0) {
                return c.json(400, { message: "Invalid or expired code" });
            }

            const otp = otps[0];
            const userId = otp.get("user");
            const user = $app.findRecordById("users", userId);

            // Generate Real Token
            const token = user.newAuthToken();

            // Note: OTP is NOT deleted here. A single magic link is frequently
            // requested more than once for the same click (e.g. the link opens
            // first in the mail client's in-app webview, then again in the real
            // browser/PWA). Deleting on first use breaks those subsequent loads
            // with "Invalid Link". The link stays valid until it expires.
            return c.json(200, { token: token, user: user });
        } catch (e) {
            console.log("OTP Verify Error:", e);
            return c.json(400, { message: "Invalid code or internal error" });
        }
    } catch (e) {
        console.error("Verify Error:", e);
        return c.json(500, { message: e.message });
    }
});
