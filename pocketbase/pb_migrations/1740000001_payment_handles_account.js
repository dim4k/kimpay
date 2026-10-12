migrate((app) => {
    // =========================================================================
    // Payment handles of a participant (paypal / revolut) are set by its own
    // account only.
    //
    // Anyone holding the URL can edit an unlinked participant: they could put
    // their own PayPal in place of someone else's, and receive the money the
    // others pay back. Now a handle can only be set on a participant linked to
    // the caller's account; clearing one stays open (it diverts nothing).
    //
    // Changes of handles now show in the history (participant_payment_changed,
    // see pb_hooks/activity.pb.js).
    // =========================================================================

    const own = (field) =>
        `(@request.body.${field}:isset = false || @request.body.${field} = '' || (user != '' && user = @request.auth.id))`;

    const participants = app.findCollectionByNameOrId("participants");
    participants.updateRule =
        "(user = '' || user = @request.auth.id) && " +
        "(@request.body.user:isset = false || @request.body.user = '' || @request.body.user = @request.auth.id) && " +
        own("paypal") + " && " + own("revolut");
    app.save(participants);

    const activities = app.findCollectionByNameOrId("activities");
    const action = activities.fields.getByName("action");
    action.values = action.values.concat(["participant_payment_changed"]);
    app.save(activities);
}, (app) => {
    const participants = app.findCollectionByNameOrId("participants");
    participants.updateRule =
        "(user = '' || user = @request.auth.id) && " +
        "(@request.body.user:isset = false || @request.body.user = '' || @request.body.user = @request.auth.id)";
    app.save(participants);

    const activities = app.findCollectionByNameOrId("activities");
    const action = activities.fields.getByName("action");
    action.values = action.values.filter((v) => v !== "participant_payment_changed");
    app.save(activities);
});
