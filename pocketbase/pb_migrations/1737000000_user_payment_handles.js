migrate((app) => {
    // =========================================================================
    // Users
    //   - paypal / revolut: the account's payment handles, entered once in the
    //     profile. Private (users can only read their own record): they are
    //     copied onto the participant of the groups where the user chooses to
    //     show them.
    // =========================================================================

    const users = app.findCollectionByNameOrId("users");
    ["paypal", "revolut"].forEach((name) =>
        users.fields.add(new TextField({ name: name, max: 64, pattern: "^[A-Za-z0-9._-]*$" })),
    );
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    ["paypal", "revolut"].forEach((name) => users.fields.removeByName(name));
    app.save(users);
});
