// =============================================================================
// Kimpay Sharing (Email invitations with magic links)
// =============================================================================

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

        // --- User Creation & Participant Linking ---
        // If a new user is created, we'll return a token for auto-login
        let user = null;
        let authToken = null;
        
        try {
            if (participantId) {
                const users = $app.findCollectionByNameOrId("users");
                
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
                    
                    // Generate auth token for auto-login
                    authToken = user.newAuthToken();
                    console.log("Generated auth token for new user");
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
            }
        } catch (authErr) {
            console.error("User/Participant Error (Non-fatal):", authErr);
            // We continue sending email even if user creation fails
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

        // Return token and user for auto-login if new user was created
        const response = { success: true, isNewUser: isNewUser };
        if (isNewUser && authToken && user) {
            response.token = authToken;
            response.user = user;
        }
        return c.json(200, response);
    } catch (e) {
        console.error("Kimpay Share Error:", e);
        return c.json(500, { message: e.message || "Internal Server Error" });
    }
});
