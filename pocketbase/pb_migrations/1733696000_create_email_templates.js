migrate((app) => {
    const collection = new Collection({
        name: "email_templates",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
    });

    collection.fields.add(new TextField({ name: "slug", required: true }));
    collection.fields.add(new TextField({ name: "locale", required: true }));
    collection.fields.add(new TextField({ name: "sender_name", required: false }));
    collection.fields.add(new EmailField({ name: "sender_address", required: false }));
    collection.fields.add(new TextField({ name: "subject", required: true }));
    collection.fields.add(new EditorField({ name: "body", required: true }));
    
    // Add unique index
    collection.indexes = [
        "CREATE UNIQUE INDEX idx_slug_locale ON email_templates (slug, locale)"
    ];

    app.save(collection);

    // Seed Data
    const templates = [
        {
            slug: "share_kimpay",
            locale: "fr",
            sender_name: "Kimpay",
            sender_address: "noreply@kimpay.io",
            subject: "Lien d'accès : {name}",
            body: `
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
            `
        },
        {
            slug: "share_kimpay",
            locale: "en",
            sender_name: "Kimpay",
            sender_address: "noreply@kimpay.io",
            subject: "Access Link: {name}",
            body: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Your Kimpay "{name}" is ready!</h2>
                    <p>Here is your unique access link:</p>
                    <p>
                        <a href="{url}" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Open Kimpay
                        </a>
                    </p>
                    <p style="color: #666; font-size: 12px;">or copy this link: {url}</p>
                </div>
            `
        }
    ];

    templates.forEach(t => {
        const record = new Record(collection);
        record.set("slug", t.slug);
        record.set("locale", t.locale);
        record.set("subject", t.subject);
        record.set("body", t.body);
        if (t.sender_name) record.set("sender_name", t.sender_name);
        if (t.sender_address) record.set("sender_address", t.sender_address);
        app.save(record);
    });

}, (app) => {
    try {
        const collection = app.findCollectionByNameOrId("email_templates");
        app.delete(collection);
    } catch (e) {
        console.log("Collection email_templates not found or already deleted");
    }
})
