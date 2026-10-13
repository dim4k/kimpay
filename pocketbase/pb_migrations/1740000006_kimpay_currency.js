migrate((app) => {
    // =========================================================================
    // The currency of a group changes through POST /api/kimpay/{id}/currency
    // only, which converts its expenses in the same transaction (see
    // pb_hooks/currency.pb.js). Changed directly, the expenses in the old
    // currency would count 1 for 1 in the new one.
    //
    // The change shows in the history (currency_changed).
    // =========================================================================

    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.updateRule = kimpays.updateRule + " && @request.body.currency:isset = false";
    app.save(kimpays);

    const activities = app.findCollectionByNameOrId("activities");
    const action = activities.fields.getByName("action");
    action.values = action.values.concat(["currency_changed"]);
    app.save(activities);
}, (app) => {
    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.updateRule = kimpays.updateRule.replace(" && @request.body.currency:isset = false", "");
    app.save(kimpays);

    const activities = app.findCollectionByNameOrId("activities");
    const action = activities.fields.getByName("action");
    action.values = action.values.filter((v) => v !== "currency_changed");
    app.save(activities);
});
