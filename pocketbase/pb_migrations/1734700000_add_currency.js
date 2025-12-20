migrate((app) => {
    // ==========================================================================
    // Add 'currency' field to 'kimpays' collection with default EUR
    // ==========================================================================
    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.fields.add(new TextField({
        name: "currency",
        required: true,
        max: 3
    }));
    app.save(kimpays);

    // Set EUR for all existing kimpays
    app.db().newQuery("UPDATE kimpays SET currency = 'EUR' WHERE currency = '' OR currency IS NULL").execute();

    // ==========================================================================
    // Add 'currency' field to 'expenses' collection with default EUR
    // ==========================================================================
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.add(new TextField({
        name: "currency",
        required: true,
        max: 3
    }));
    app.save(expenses);

    // Set EUR for all existing expenses
    app.db().newQuery("UPDATE expenses SET currency = 'EUR' WHERE currency = '' OR currency IS NULL").execute();

    // ==========================================================================
    // Add 'preferred_currency' field to 'users' collection (optional)
    // ==========================================================================
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({
        name: "preferred_currency",
        required: false,
        max: 3
    }));
    app.save(users);

    // Set EUR for all existing users
    app.db().newQuery("UPDATE users SET preferred_currency = 'EUR' WHERE preferred_currency = '' OR preferred_currency IS NULL").execute();

}, (app) => {
    // Rollback: Remove currency fields
    try {
        const kimpays = app.findCollectionByNameOrId("kimpays");
        kimpays.fields.removeByName("currency");
        app.save(kimpays);
    } catch(e) { console.log("Rollback kimpays currency failed", e); }

    try {
        const expenses = app.findCollectionByNameOrId("expenses");
        expenses.fields.removeByName("currency");
        app.save(expenses);
    } catch(e) { console.log("Rollback expenses currency failed", e); }

    try {
        const users = app.findCollectionByNameOrId("users");
        users.fields.removeByName("preferred_currency");
        app.save(users);
    } catch(e) { console.log("Rollback users preferred_currency failed", e); }
});
