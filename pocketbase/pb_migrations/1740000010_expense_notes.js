migrate((app) => {
    // =========================================================================
    // A note on an expense: free text under its other settings ("deposit,
    // the rest on arrival", "receipt at Léa's"). Read by the search and the
    // export, shown on the read-only link, kept by repeated copies.
    // =========================================================================

    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.add(new TextField({
        name: "notes",
        max: 500,
    }));
    app.save(expenses);
}, (app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.removeByName("notes");
    app.save(expenses);
});
