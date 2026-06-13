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
            participantId: "", // Added participantId
        });

        try {
            c.bindBody(data);
        } catch (err) {
            console.log("bindBody failed:", err);
            return c.json(400, {
                message: "Invalid JSON body",
                error: err.message,
            });
        }

        console.log("Parsed Data:", JSON.stringify(data));

        const email = data.email;
        let url = data.url; // Mutable to append token
        const kimpayName = data.kimpayName;
        const participantId = data.participantId;

        let isNewUser = false; // Lifted scope for access in return statement

        if (!email || !url) {
            return c.json(400, {
                message: "Missing email or url",
                received: data,
            });
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
                    const participant = $app.findRecordById(
                        "participants",
                        participantId,
                    );
                    if (!participant.get("user")) {
                        // Only if not already linked
                        participant.set("user", user.id);
                        $app.save(participant);
                        console.log(
                            "Linked participant",
                            participantId,
                            "to user",
                            user.id,
                        );
                    }
                } catch (e) {
                    console.log("Error linking participant:", e);
                }
            }
        } catch (authErr) {
            console.error("User/Participant Error (Non-fatal):", authErr);
            // We continue sending email even if user creation fails
        }
        // -------------------------------

        const locale = data.locale || "fr";
        const creatorName = data.creator || "Un ami";

        const defaultHtml = `
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

        try {
            const { sendTemplatedEmail } = require(`${__hooks}/lib/email.js`);
            sendTemplatedEmail({
                slug: "share_kimpay",
                locale: locale,
                to: email,
                vars: {
                    name: kimpayName,
                    url: url,
                    creator: creatorName,
                },
                fallbackSubject: `Lien d'accès : {name}`,
                fallbackHtml: defaultHtml,
                // Plaintext version for better deliverability score
                text: `${kimpayName}\n${url}`,
            });
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
