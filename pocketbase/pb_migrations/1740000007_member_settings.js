migrate((app) => {
    // =========================================================================
    // Participants
    //   - joined: the person uses the group (chose this name on a device, has
    //     an account, or created something in it). Shown on the Members tab:
    //     "Not here yet" with an invite button otherwise. Cosmetic: set by the
    //     app when a device picks the name.
    //   - inactive: no longer ticked by default in new expenses (someone who
    //     left the trip early, and cannot be removed since they share
    //     expenses).
    //   - default_shares: shares of the person in new expenses (a couple
    //     counting as 2). 0 = 1.
    //
    // inactive / default_shares are set by anyone in the group, for anyone,
    // through POST /api/kimpay/{id}/participants/{pid}/defaults only (which
    // logs it in the history): the updateRule keeps a member linked to an
    // account editable by that account alone.
    // =========================================================================

    const participants = app.findCollectionByNameOrId("participants");
    participants.fields.add(new BoolField({ name: "joined" }));
    participants.fields.add(new BoolField({ name: "inactive" }));
    participants.fields.add(new NumberField({ name: "default_shares", min: 0, max: 20, onlyInt: true }));
    participants.updateRule =
        participants.updateRule +
        " && @request.body.inactive:isset = false && @request.body.default_shares:isset = false";
    app.save(participants);

    // Who already used the group: an account, the creator, or anyone who
    // added or changed something in it.
    app.db()
        .newQuery(
            "UPDATE participants SET joined = 1 WHERE user != ''" +
                " OR id IN (SELECT created_by FROM kimpays)" +
                " OR id IN (SELECT created_by FROM expenses)" +
                " OR id IN (SELECT actor FROM activities)",
        )
        .execute();

    const activities = app.findCollectionByNameOrId("activities");
    const action = activities.fields.getByName("action");
    action.values = action.values.concat(["participant_defaults_changed"]);
    app.save(activities);
}, (app) => {
    const participants = app.findCollectionByNameOrId("participants");
    ["joined", "inactive", "default_shares"].forEach((name) => participants.fields.removeByName(name));
    participants.updateRule = participants.updateRule.replace(
        " && @request.body.inactive:isset = false && @request.body.default_shares:isset = false",
        "",
    );
    app.save(participants);

    const activities = app.findCollectionByNameOrId("activities");
    const action = activities.fields.getByName("action");
    action.values = action.values.filter((v) => v !== "participant_defaults_changed");
    app.save(activities);
});
