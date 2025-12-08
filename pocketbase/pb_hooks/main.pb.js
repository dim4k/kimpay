routerAdd("POST", "/api/kimpay/share", (c) => {
    try {
        console.log("Kimpay Share - Request received");
        
        // DynamicModel is a special PocketBase helper to create a struct-like object
        // that can be used with Go's Unmarshal via c.bindBody()
        const data = new DynamicModel({
            email: "",
            url: "",
            kimpayName: "",
            locale: ""
        });
        
        try {
            c.bindBody(data);
        } catch (err) {
            console.log("bindBody failed:", err);
            return c.json(400, { message: "Invalid JSON body", error: err.message });
        }

        console.log("Parsed Data:", JSON.stringify(data));

        const email = data.email;
        const url = data.url;
        const kimpayName = data.kimpayName;

        if (!email || !url) {
            return c.json(400, { message: "Missing email or url", received: data });
        }

        const settings = $app.settings();
        let senderName = "Kimpay";
        let senderAddress = "noreply@kimpay.io";

        if (settings.meta.senderName) senderName = settings.meta.senderName;
        if (settings.meta.senderAddress) senderAddress = settings.meta.senderAddress;

        const locale = data.locale || 'fr';

        // 1. Fetch Template
        let template;
        try {
             // Try specific locale
             template = $app.dao().findFirstRecordByData("email_templates", "slug", "share_kimpay", "locale", locale);
        } catch(e) {
            // Fallback to English
            try {
                 template = $app.dao().findFirstRecordByData("email_templates", "slug", "share_kimpay", "locale", "en");
            } catch(e2) {
                console.log("No email template found for share_kimpay");
            }
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
        subject = subject.replaceAll("{name}", kimpayName).replaceAll("{url}", url);
        html = html.replaceAll("{name}", kimpayName).replaceAll("{url}", url);

        const message = new MailerMessage({
            from: {
                address: senderAddress,
                name:    senderName,
            },
            to:      [{ address: email }],
            subject: subject,
            html:    html,
        });

        try {
            $app.newMailClient().send(message);
        } catch (err) {
            console.log("Email send failed (likely no SMTP configured):", err);
            // We don't throw here to avoid 500 error on the frontend
            // since email is optional.
        }

        return c.json(200, { success: true });
    } catch (e) {
        console.error("Kimpay Share Error:", e);
        return c.json(500, { message: e.message || "Internal Server Error" });
    }
});
