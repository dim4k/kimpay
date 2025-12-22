// =============================================================================
// Authentication (Magic Links, Registration, OTP Verification)
// =============================================================================

routerAdd("POST", "/api/login/magic-link", (c) => {
    try {
        const data = new DynamicModel({
            email: "",
            locale: "",
            url: ""
        });
        
        try {
            c.bindBody(data);
        } catch (err) {
            return c.json(400, { message: "Invalid JSON body", error: err.message });
        }

        const email = data.email;
        const locale = data.locale || 'en';

        if (!email) {
            return c.json(400, { message: "Missing email" });
        }

        let user;

        try {
            user = $app.findAuthRecordByEmail("users", email);
        } catch (e) {
            return c.json(404, { message: "User not found" });
        }

        // Generate OTP
        const code = $security.randomString(64);
        const otps = $app.findCollectionByNameOrId("auth_otps");
        const otpRecord = new Record(otps);
        otpRecord.set("code", code);
        otpRecord.set("user", user.id);
        
        // Set Expiration (7 days)
        const now = new Date();
        now.setDate(now.getDate() + 7);
        otpRecord.set("expires", now.toISOString().replace("T", " ").replace("Z", "")); // PB format
        
        $app.save(otpRecord);

        // Construct URL
        let origin = data.url;
        
        if (!origin || origin.trim() === "") {
             return c.json(400, { message: "Missing url origin" });
        }
        
        const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
        const url = `${cleanOrigin}/?code=${code}`;

        // Send Email
        const settings = $app.settings();
        let senderName = "Kimpay";
        let senderAddress = "no-reply@kimpay.io";

        if (settings.meta.senderName) senderName = settings.meta.senderName;
        if (settings.meta.senderAddress) senderAddress = settings.meta.senderAddress;

        // Fetch Template
        let template;
        try {
             const records = $app.findRecordsByFilter(
                 "email_templates", 
                 "slug='login_magic_link' && locale='" + locale + "'"
             );
             
             if (records && records.length > 0) {
                 template = records[0];
             } else {
                 const recordsEn = $app.findRecordsByFilter(
                    "email_templates", 
                    "slug='login_magic_link' && locale='en'"
                 );
                 if (recordsEn && recordsEn.length > 0) {
                    template = recordsEn[0];
                 }
             }
        } catch(e) {
            console.log("Error fetching template:", e);
        }

        let subject = template ? template.get("subject") : "Login to Kimpay";
        let html = template ? template.get("body") : `<a href="${url}">Login</a>`;

        if (template) {
             const tSenderName = template.get("sender_name");
             const tSenderAddress = template.get("sender_address");
             if (tSenderName) senderName = tSenderName;
             if (tSenderAddress) senderAddress = tSenderAddress;
        }

        // Replace Variables
        subject = subject.replaceAll("{url}", url).replaceAll("{name}", user.get("name") || "User");
        html = html.replaceAll("{url}", url).replaceAll("{name}", user.get("name") || "User");

        const message = new MailerMessage({
            from: {
                address: senderAddress,
                name:    senderName,
            },
            to:      [{ address: email }],
            subject: subject,
            html:    html,
            text:    `${subject}\n\n${url}`,
        });

        $app.newMailClient().send(message);

        return c.json(200, { success: true });

    } catch (e) {
        console.error("Magic Link Error:", e);
        return c.json(500, { message: e.message });
    }
});

routerAdd("POST", "/api/register", (c) => {
    try {
        const data = new DynamicModel({
            email: "",
            name: "",
            locale: "",
            url: "",
            participantId: ""
        });
        
        try {
            c.bindBody(data);
        } catch (err) {
            return c.json(400, { message: "Invalid JSON body", error: err.message });
        }

        const email = data.email;
        const name = data.name;
        const locale = data.locale || 'en';
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
                const participant = $app.findRecordById("participants", participantId);
                if (!participant.get("user")) { 
                    participant.set("user", user.id);
                    $app.save(participant);
                }
            } catch(e) {
                console.log("Error linking participant during registration:", e);
            }
        }

        // 4. Send Magic Link (Reuse logic by creating OTP)
        // Generate OTP
        const code = $security.randomString(64);
        const otps = $app.findCollectionByNameOrId("auth_otps");
        const otpRecord = new Record(otps);
        otpRecord.set("code", code);
        otpRecord.set("user", user.id);
        
        // Set Expiration (7 days)
        const now = new Date();
        now.setDate(now.getDate() + 7);
        otpRecord.set("expires", now.toISOString().replace("T", " ").replace("Z", ""));
        
        $app.save(otpRecord);

        // Construct URL
        let origin = data.url;
        if (!origin || origin.trim() === "") {
             // Fallback if not provided, though it should be
             return c.json(200, { success: true, message: "User created but URL missing for magic link" });
        }
        
        const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
        const url = `${cleanOrigin}/?code=${code}`;

        // Send Email
        const settings = $app.settings();
        let senderName = "Kimpay";
        let senderAddress = "no-reply@kimpay.io";

        if (settings.meta.senderName) senderName = settings.meta.senderName;
        if (settings.meta.senderAddress) senderAddress = settings.meta.senderAddress;

        // Fetch Template (Reuse login magic link template for now)
        let template;
        try {
             const records = $app.findRecordsByFilter(
                 "email_templates", 
                 "slug='login_magic_link' && locale='" + locale + "'"
             );
             
             if (records && records.length > 0) {
                 template = records[0];
             } else {
                 const recordsEn = $app.findRecordsByFilter(
                    "email_templates", 
                    "slug='login_magic_link' && locale='en'"
                 );
                 if (recordsEn && recordsEn.length > 0) {
                    template = recordsEn[0];
                 }
             }
        } catch(e) {
            console.log("Error fetching template:", e);
        }

        let subject = template ? template.get("subject") : "Welcome to Kimpay";
        let html = template ? template.get("body") : `<a href="${url}">Login</a>`;

        if (template) {
             const tSenderName = template.get("sender_name");
             const tSenderAddress = template.get("sender_address");
             if (tSenderName) senderName = tSenderName;
             if (tSenderAddress) senderAddress = tSenderAddress;
        }

        // Replace Variables
        subject = subject.replaceAll("{url}", url).replaceAll("{name}", name);
        html = html.replaceAll("{url}", url).replaceAll("{name}", name);

        const message = new MailerMessage({
            from: {
                address: senderAddress,
                name:    senderName,
            },
            to:      [{ address: email }],
            subject: subject,
            html:    html,
            text:    `${subject}\n\n${url}`,
        });

        $app.newMailClient().send(message);

        return c.json(200, { success: true });

    } catch (e) {
        console.error("Register Error:", e);
        return c.json(500, { message: e.message });
    }
});

routerAdd("POST", "/api/login/verify", (c) => {
    try {
        const data = new DynamicModel({
            code: ""
        });
        
        try {
            c.bindBody(data);
        } catch (err) {
            return c.json(400, { message: "Invalid JSON body", error: err.message });
        }

        if (!data.code) {
             return c.json(400, { message: "Missing code" });
        }

        // Find OTP
        try {
            // Need to filter by code AND expiration > NOW
            // PocketBase SQL format for dates: YYYY-MM-DD HH:MM:SS.SSSZ
            const now = new Date().toISOString().replace("T", " ").replace("Z", "");
            
            // PB Go API: findRecordsByFilter(collection, filter, sort, limit, offset, params)
            // But here we use standard filter syntax
            const otps = $app.findRecordsByFilter(
                "auth_otps", 
                `code='${data.code}' && expires >= '${now}'`
            );

            if (!otps || otps.length === 0) {
                return c.json(400, { message: "Invalid or expired code" });
            }

            const otp = otps[0];
            const userId = otp.get("user");
            const user = $app.findRecordById("users", userId);

            // Generate Real Token
            const token = user.newAuthToken();

            // Note: OTP is NOT deleted - can be reused until expiration

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
