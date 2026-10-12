migrate((app) => {
    // =========================================================================
    // Kimpays
    //   - owner:          the account allowed to delete the group. Set by the
    //                     server only: at creation when logged in, or later by
    //                     POST /api/kimpay/{id}/own with the creator key.
    //   - owner_key_hash: SHA-256 of the creator key, a secret kept by the
    //                     device that created the group as a guest (hidden).
    //
    // Deleting used to need only `created_by.user = me`. But anyone holding the
    // URL can link an unlinked participant to their account: claiming the
    // creator of a guest group was enough to delete it, with its history.
    // Now the account must also be the owner, which a claim does not give.
    //
    // Groups whose creator is already linked keep that account as owner.
    // =========================================================================

    const users = app.findCollectionByNameOrId("users");
    const kimpays = app.findCollectionByNameOrId("kimpays");

    kimpays.fields.add(new RelationField({
        name: "owner",
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
    }));
    kimpays.fields.add(new TextField({ name: "owner_key_hash", max: 64, hidden: true }));

    const serverOnly = "@request.body.owner:isset = false && @request.body.owner_key_hash:isset = false";
    kimpays.createRule = serverOnly;
    kimpays.updateRule = "(@request.body.created_by:isset = false || created_by = '') && " + serverOnly;
    kimpays.deleteRule = "@request.auth.id != '' && owner = @request.auth.id && created_by.user = @request.auth.id";
    app.save(kimpays);

    app.db()
        .newQuery(
            "UPDATE kimpays SET owner = COALESCE((SELECT user FROM participants WHERE participants.id = kimpays.created_by), '') " +
            "WHERE created_by != '' AND owner = ''",
        )
        .execute();
}, (app) => {
    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.fields.removeByName("owner");
    kimpays.fields.removeByName("owner_key_hash");
    kimpays.createRule = "";
    kimpays.updateRule = "@request.body.created_by:isset = false || created_by = ''";
    kimpays.deleteRule = "@request.auth.id != '' && created_by.user = @request.auth.id";
    app.save(kimpays);
});
