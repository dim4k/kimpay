routerAdd("POST", "/api/kimpay/share", (c) => {
    try {
        console.log("Kimpay Share - Request received");
        
        const data = new DynamicModel({
            email: "",
            url: "",
            kimpayName: "",
            locale: "",
            creator: "",
            participantId: "" // Added participantId
        });
        
        try {
            c.bindBody(data);
        } catch (err) {
            console.log("bindBody failed:", err);
            return c.json(400, { message: "Invalid JSON body", error: err.message });
        }

        console.log("Parsed Data:", JSON.stringify(data));

        const email = data.email;
        let url = data.url; // Mutable to append token
        const kimpayName = data.kimpayName;
        const participantId = data.participantId;
        
        let isNewUser = false; // Lifted scope for access in return statement

        if (!email || !url) {
            return c.json(400, { message: "Missing email or url", received: data });
        }

        // --- Auth & Magic Link Logic ---
        try {
            if (participantId) {
                const users = $app.findCollectionByNameOrId("users");
                let user;
                
                // 1. Try to find existing user
                try {
                    user = $app.findAuthRecordByEmail("users", email);
                    console.log("Found existing user:", user.id);
                } catch (e) {
                    // User not found, create new one
                    console.log("User not found, creating new one for:", email);
                    isNewUser = true;
                    user = new Record(users);
                    user.setEmail(email);
                    const generatedPassword = $security.randomString(20);
                    user.setPassword(generatedPassword); // Random password
                    user.setVerified(true); // Auto-verify
                    user.set("name", data.creator || "User"); // Default name
                    $app.save(user);
                }

                // 2. Link Participant to User
                try {
                    const participant = $app.findRecordById("participants", participantId);
                    if (!participant.get("user")) { // Only if not already linked
                        participant.set("user", user.id);
                        $app.save(participant);
                        console.log("Linked participant", participantId, "to user", user.id);
                    }
                } catch(e) {
                    console.log("Error linking participant:", e);
                }

                // 3. Generate OTP instead of Token
                const code = $security.randomString(64);
                const otps = $app.findCollectionByNameOrId("auth_otps");
                const otpRecord = new Record(otps);
                otpRecord.set("code", code);
                otpRecord.set("user", user.id);
                
                // Set Expiration (10 mins)
                const now = new Date();
                now.setMinutes(now.getMinutes() + 10);
                otpRecord.set("expires", now.toISOString().replace("T", " ").replace("Z", "")); // PB format
                
                $app.save(otpRecord);
                
                // 4. Append to URL
                // Check if url already has params
                const separator = url.includes("?") ? "&" : "?";
                url = `${url}${separator}code=${code}`;
                console.log("Magic Link generated with OTP code");
            }
        } catch (authErr) {
            console.error("Auth Magic Link Error (Non-fatal):", authErr);
            // We continue sending email even if auth fails
        }
        // -------------------------------

        const settings = $app.settings();
        let senderName = "Kimpay";
        let senderAddress = "no-reply@kimpay.io";

        if (settings.meta.senderName) senderName = settings.meta.senderName;
        if (settings.meta.senderAddress) senderAddress = settings.meta.senderAddress;

        const locale = data.locale || 'fr';
        const creatorName = data.creator || "Un ami";

        // 1. Fetch Template
        let template;
        try {
             const records = $app.findRecordsByFilter(
                 "email_templates", 
                 "slug='share_kimpay' && locale='" + locale + "'"
             );
             
             if (records && records.length > 0) {
                 template = records[0];
             } else {
                 const recordsEn = $app.findRecordsByFilter(
                    "email_templates", 
                    "slug='share_kimpay' && locale='en'"
                 );
                 if (recordsEn && recordsEn.length > 0) {
                    template = recordsEn[0];
                 }
             }
        } catch(e) {
            console.log("Error fetching template:", e);
        }

        // 2. Prepare Content (with defaults if missing)
        let subject = template 
            ? template.get("subject") 
            : `Lien d'accès : {name}`;
            
        let html = template 
            ? template.get("body") 
            : `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Votre Kimpay "{name}" est prêt !</h2>
                    <p>Voici votre lien d'accès unique :</p>
                    <p>
                        <a href="{url}" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Accéder au Kimpay
                        </a>
                    </p>
                    <p style="color: #666; font-size: 12px;">ou copiez ce lien : {url}</p>
                </div>
            `;
            
        if (template) {
             const tSenderName = template.get("sender_name");
             const tSenderAddress = template.get("sender_address");
             if (tSenderName) senderName = tSenderName;
             if (tSenderAddress) senderAddress = tSenderAddress;
        }

        // 3. Replace Variables
        subject = subject.replaceAll("{name}", kimpayName).replaceAll("{url}", url).replaceAll("{creator}", creatorName);
        html = html.replaceAll("{name}", kimpayName).replaceAll("{url}", url).replaceAll("{creator}", creatorName);

        const message = new MailerMessage({
            from: {
                address: senderAddress,
                name:    senderName,
            },
            to:      [{ address: email }],
            subject: subject,
            html:    html,
            // Add plaintext version for better deliverability score
            text:    `${subject}\n\n${kimpayName}\n${url}`,
        });

        try {
            $app.newMailClient().send(message);
        } catch (err) {
            console.log("Email send failed (likely no SMTP configured):", err);
        }

        return c.json(200, { success: true, isNewUser: isNewUser });
    } catch (e) {
        console.error("Kimpay Share Error:", e);
        return c.json(500, { message: e.message || "Internal Server Error" });
    }
});

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
        
        // Set Expiration (10 mins)
        const now = new Date();
        now.setMinutes(now.getMinutes() + 10);
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

            // BURN THE OTP (Prevent Replay)
            $app.delete(otp);

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
