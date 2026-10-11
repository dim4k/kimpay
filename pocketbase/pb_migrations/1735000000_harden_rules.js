migrate((app) => {
    // =========================================================================
    // Harden write rules.
    //
    // 1. users.createRule: accounts are only created by /api/register (which
    //    bypasses rules). A public createRule let anyone pre-register someone
    //    else's email with a password of their choice.
    //
    // 2. kimpays.updateRule: `created_by` can only be set while still empty
    //    (done once, right after creation). Otherwise anyone holding the URL
    //    could make themselves "creator" and satisfy the deleteRule.
    //
    // 3. participants.updateRule: the *new* `user` value must be empty or the
    //    caller. The previous rule only checked the stored value, so a guest
    //    could link a participant to any user id.
    //
    // 4. Restore an image mime-type whitelist on uploads (reset to "any type"
    //    by 1710000002_increase_file_limits).
    // =========================================================================

    const imageTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heic",
        "image/heif",
        "image/avif",
    ];

    const users = app.findCollectionByNameOrId("users");
    users.createRule = null;
    app.save(users);

    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.updateRule = "@request.body.created_by:isset = false || created_by = ''";
    app.save(kimpays);

    const participants = app.findCollectionByNameOrId("participants");
    participants.updateRule =
        "(user = '' || user = @request.auth.id) && " +
        "(@request.body.user:isset = false || @request.body.user = '' || @request.body.user = @request.auth.id)";
    const avatar = participants.fields.getByName("avatar");
    if (avatar) avatar.mimeTypes = imageTypes;
    app.save(participants);

    const expenses = app.findCollectionByNameOrId("expenses");
    const photos = expenses.fields.getByName("photos");
    if (photos) photos.mimeTypes = imageTypes;
    app.save(expenses);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.createRule = "";
    app.save(users);

    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.updateRule = "";
    app.save(kimpays);

    const participants = app.findCollectionByNameOrId("participants");
    participants.updateRule = "user = '' || user = @request.auth.id";
    const avatar = participants.fields.getByName("avatar");
    if (avatar) avatar.mimeTypes = [];
    app.save(participants);

    const expenses = app.findCollectionByNameOrId("expenses");
    const photos = expenses.fields.getByName("photos");
    if (photos) photos.mimeTypes = [];
    app.save(expenses);
});
