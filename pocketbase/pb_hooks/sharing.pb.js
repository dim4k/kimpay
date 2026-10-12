// =============================================================================
// Kimpay Sharing (send the capability link by email)
//
// SECURITY: This endpoint ONLY sends an email containing the capability URL to
// the given address. It deliberately does NOT create accounts, link
// participants, or return auth tokens. Account creation and participant linking
// happen later, when the recipient actually logs in via the magic link
// (see the client-side claim flow). An unauthenticated endpoint that minted
// sessions for arbitrary emails would be an account-takeover vector.
//
// It is not an open relay either: the link must be the one of an existing
// group of the app, the group name is read from it (never taken from the
// body), and each address gets a few emails at most.
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

        if (!email || !url) {
            return c.json(400, { message: "Missing email or url" });
        }

        // Basic email format validation.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return c.json(400, { message: "Invalid email" });
        }

        // Rate limiting: 5 share emails per minute per IP, 3 per 10 minutes
        // per address (prevents using this endpoint to spam anyone).
        const clientIp = c.realIP();
        const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
        if (
            !checkRateLimit(`share_${clientIp}`, 5, 60 * 1000) ||
            !checkRateLimit(`share_mail_${email.toLowerCase()}`, 3, 10 * 60 * 1000)
        ) {
            return c.json(429, {
                message: "Too many requests. Please wait a minute.",
            });
        }

        // Only the link of an existing group of the app can be sent (no open
        // email relay): `<app origin>/k/<id>`.
        const { isAllowedOrigin } = require(`${__hooks}/lib/origin.js`);
        const link = /^(https?:\/\/[^\/?#\s]+)\/k\/([a-zA-Z0-9]{15})$/.exec(url);
        if (!link || !isAllowedOrigin(link[1])) {
            return c.json(400, { message: "Invalid url" });
        }
        let kimpay;
        try {
            kimpay = $app.findRecordById("kimpays", link[2]);
        } catch (err) {
            return c.json(400, { message: "Invalid url" });
        }
        const kimpayName = kimpay.getString("name");

        const locale = data.locale || "fr";
        const creatorName = String(data.creator || "").trim().slice(0, 50) || "Un ami";

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
