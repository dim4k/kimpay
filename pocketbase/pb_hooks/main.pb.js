routerAdd("POST", "/api/kimpay/share", (c) => {
    try {
        console.log("Kimpay Share - Request received");
        
        // DynamicModel is a special PocketBase helper to create a struct-like object
        // that can be used with Go's Unmarshal via c.bindBody()
        const data = new DynamicModel({
            email: "",
            url: "",
            kimpayName: ""
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
        let senderAddress = "noreply@kimpay.app";

        if (settings.meta.senderName) senderName = settings.meta.senderName;
        if (settings.meta.senderAddress) senderAddress = settings.meta.senderAddress;

        const message = new MailerMessage({
            from: {
                address: senderAddress,
                name:    senderName,
            },
            to:      [{ address: email }],
            subject: `Lien d'accès : ${kimpayName}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Votre Kimpay "${kimpayName}" est prêt !</h2>
                    <p>Voici votre lien d'accès unique :</p>
                    <p>
                        <a href="${url}" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Accéder au Kimpay
                        </a>
                    </p>
                    <p style="color: #666; font-size: 12px;">ou copiez ce lien : ${url}</p>
                </div>
            `,
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
