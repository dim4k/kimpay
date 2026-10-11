migrate((app) => {
    // =========================================================================
    // Expenses
    //   - split:         how an expense is shared between the involved
    //                    participants ({ mode, values }). Empty / "equal" mode
    //                    = equal split (all expenses created before this).
    //   - is_income:     money received by the group (a refund, a deposit
    //                    returned...): the "payer" is the one who received it.
    //   - exchange_rate: rate from the expense currency to the Kimpay currency,
    //                    frozen at the expense date. 0 = unknown, today's rate
    //                    is used instead.
    //
    // Participants
    //   - paypal / revolut: public payment handles (paypal.me/<x>, revolut.me/<x>)
    //
    // Kimpays
    //   - readonly_token: secret of the read-only summary link (empty = no link).
    //     Unlike the Kimpay ID, it grants no write access.
    // =========================================================================

    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.add(new JSONField({ name: "split", maxSize: 20000 }));
    expenses.fields.add(new BoolField({ name: "is_income" }));
    expenses.fields.add(new NumberField({ name: "exchange_rate", min: 0 }));
    app.save(expenses);

    const participants = app.findCollectionByNameOrId("participants");
    ["paypal", "revolut"].forEach((name) =>
        participants.fields.add(new TextField({ name: name, max: 64, pattern: "^[A-Za-z0-9._-]*$" })),
    );
    app.save(participants);

    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.fields.add(new TextField({ name: "readonly_token", max: 64 }));
    kimpays.indexes.push(
        "CREATE UNIQUE INDEX idx_readonly_token ON kimpays (readonly_token) WHERE readonly_token != ''",
    );
    app.save(kimpays);
}, (app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    ["split", "is_income", "exchange_rate"].forEach((name) => expenses.fields.removeByName(name));
    app.save(expenses);

    const participants = app.findCollectionByNameOrId("participants");
    ["paypal", "revolut"].forEach((name) => participants.fields.removeByName(name));
    app.save(participants);

    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.indexes = kimpays.indexes.filter((idx) => idx.indexOf("idx_readonly_token") === -1);
    kimpays.fields.removeByName("readonly_token");
    app.save(kimpays);
});
