migrate((app) => {
    // =========================================================================
    // Expenses repeated every month (rent, internet, subscriptions), copied by
    // the `repeat_expenses` cron (pb_hooks/repeat.pb.js):
    //
    //   repeat_day   day of the month the copies fall on (1-31, the last day
    //                of shorter months); 0 = not repeated
    //   repeat_next  date of the next copy, always in the future when set by
    //                the app (no copy of past months)
    //   repeat_of    the expense this one was copied from
    //
    // Only the latest of a series repeats: the cron moves `repeat_day` and
    // `repeat_next` to each copy it makes, so stopping is done on that one.
    // Set by anyone in the group, like any other field of an expense.
    // =========================================================================

    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.add(new NumberField({ name: "repeat_day", min: 0, max: 31, onlyInt: true }));
    expenses.fields.add(new DateField({ name: "repeat_next" }));
    expenses.fields.add(new TextField({ name: "repeat_of", max: 15 }));
    expenses.indexes = expenses.indexes.concat([
        "CREATE INDEX idx_expenses_repeat_next ON expenses (repeat_next) WHERE repeat_day > 0",
    ]);
    app.save(expenses);

    const activities = app.findCollectionByNameOrId("activities");
    const action = activities.fields.getByName("action");
    action.values = action.values.concat(["expense_repeated"]);
    app.save(activities);
}, (app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    ["repeat_day", "repeat_next", "repeat_of"].forEach((name) => expenses.fields.removeByName(name));
    expenses.indexes = expenses.indexes.filter((index) => !index.includes("idx_expenses_repeat_next"));
    app.save(expenses);

    const activities = app.findCollectionByNameOrId("activities");
    const action = activities.fields.getByName("action");
    action.values = action.values.filter((v) => v !== "expense_repeated");
    app.save(activities);
});
