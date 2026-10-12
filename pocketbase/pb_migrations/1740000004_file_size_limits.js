migrate((app) => {
    // =========================================================================
    // Smaller file size limits (they were raised to 50 MB / 20 MB by
    // 1710000002_increase_file_limits). A phone photo is a few MB; these files
    // can be sent without an account (see also pb_hooks/quota.pb.js).
    // =========================================================================

    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.getByName("photos").maxSize = 20 * 1024 * 1024;
    app.save(expenses);

    const participants = app.findCollectionByNameOrId("participants");
    participants.fields.getByName("avatar").maxSize = 10 * 1024 * 1024;
    app.save(participants);
}, (app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.getByName("photos").maxSize = 52428800;
    app.save(expenses);

    const participants = app.findCollectionByNameOrId("participants");
    participants.fields.getByName("avatar").maxSize = 20971520;
    app.save(participants);
});
