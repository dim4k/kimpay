migrate((app) => {
    // =========================================================================
    // auth_otps (magic links)
    //   - code: now the SHA-256 of the code sent by email (a leaked database
    //     gives no working link). Existing codes are hashed in place, so the
    //     links already sent keep working.
    //   - used: first time the link was opened. It then stays valid a few
    //     minutes only (the same link is often opened twice: mail webview,
    //     then browser), no longer until it expires (24 h).
    // =========================================================================

    const collection = app.findCollectionByNameOrId("auth_otps");
    collection.fields.add(new DateField({ name: "used" }));
    app.save(collection);

    const records = app.findAllRecords("auth_otps");
    for (let i = 0; i < records.length; i++) {
        records[i].set("code", $security.sha256(records[i].getString("code")));
        app.save(records[i]);
    }
}, (app) => {
    // Hashes cannot be turned back into codes: drop the pending links.
    app.db().newQuery("DELETE FROM auth_otps").execute();
    const collection = app.findCollectionByNameOrId("auth_otps");
    collection.fields.removeByName("used");
    app.save(collection);
});
