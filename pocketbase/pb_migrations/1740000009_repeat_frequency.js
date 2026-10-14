migrate((app) => {
    // =========================================================================
    // Repeated expenses (1740000008): how often, besides every month.
    //
    //   repeat_every  week | two_weeks | month | quarter | year; empty reads
    //                 as month. Monthly frequencies fall on `repeat_day` (the
    //                 last day of shorter months), weekly ones on the weekday
    //                 of the expense. `repeat_day` > 0 still says "repeated".
    //
    // Moved to each copy with the rest of the repetition (pb_hooks/lib/repeat.js).
    // =========================================================================

    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.add(new SelectField({
        name: "repeat_every",
        maxSelect: 1,
        values: ["week", "two_weeks", "month", "quarter", "year"],
    }));
    app.save(expenses);

    // Those repeated so far: every month, the only choice there was.
    app.db().newQuery("UPDATE expenses SET repeat_every = 'month' WHERE repeat_day > 0").execute();
}, (app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.removeByName("repeat_every");
    app.save(expenses);
});
