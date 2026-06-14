// =============================================================================
// Kimpay Sharing (send the capability link by email)
//
// SECURITY: This endpoint ONLY sends an email containing the capability URL to
// the given address. It deliberately does NOT create accounts, link
// participants, or return auth tokens. Account creation and participant linking
// happen later, when the recipient actually logs in via the magic link
// (see the client-side claim flow). An unauthenticated endpoint that minted
// sessions for arbitrary emails would be an account-takeover vector.
// =============================================================================

routerAdd("POST", "/api/kimpay/share", (c) => {
    try {
        const data = new DynamicModel({
            email: "",
            url: "",
            kimpayName: "",
            locale: "",
            creator: "",
        });

        try {
            c.bindBody(data);
        } catch (err) {
            return c.json(400, { message: "Invalid JSON body" });
        }

        const email = (data.email || "").trim();
        const url = (data.url || "").trim();
        const kimpayName = data.kimpayName;

        if (!email || !url) {
            return c.json(400, { message: "Missing email or url" });
        }

        // Basic email format validation.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return c.json(400, { message: "Invalid email" });
        }

        // Rate limiting: 5 share emails per minute per IP (prevents using this
        // endpoint to spam arbitrary addresses).
        const clientIp = c.realIP();
        const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
        if (!checkRateLimit(`share_${clientIp}`, 5, 60 * 1000)) {
            return c.json(429, {
                message: "Too many requests. Please wait a minute.",
            });
        }

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
            // Email delivery may fail when no SMTP is configured; not fatal.
            console.error("Kimpay Share - email send failed");
        }

        return c.json(200, { success: true });
    } catch (e) {
        console.error("Kimpay Share Error");
        return c.json(500, { message: "Internal Server Error" });
    }
});
