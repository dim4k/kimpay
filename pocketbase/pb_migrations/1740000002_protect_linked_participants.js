migrate((app) => {
    // =========================================================================
    // A participant linked to an account is deleted by that account only, like
    // it is edited (updateRule). The deleteRule had stayed public since
    // 1733670020_fix_permissions: anyone holding the URL could remove a member
    // with an account (the merge route follows this rule too).
    // =========================================================================

    const participants = app.findCollectionByNameOrId("participants");
    participants.deleteRule = "user = '' || user = @request.auth.id";
    app.save(participants);
}, (app) => {
    const participants = app.findCollectionByNameOrId("participants");
    participants.deleteRule = "";
    app.save(participants);
});
