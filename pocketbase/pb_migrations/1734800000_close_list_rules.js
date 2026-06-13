migrate((app) => {
    // =========================================================================
    // Close mass-listing on expenses & participants.
    //
    // Previously `listRule = ""` (public) allowed any unauthenticated client to
    // call `getList()` and dump ALL expenses/participants across ALL groups
    // (broken access control / enumeration).
    //
    // Guests keep working through the capability-URL model:
    //   - read via `getOne` + `expand` on the Kimpay (ViewRule stays public)
    //   - realtime via the single `kimpays/{id}` subscription (ViewRule)
    // so a public `listRule` is no longer needed.
    //
    // kimpays.listRule is already null (set by 1734275000_secure_access).
    // =========================================================================

    // Expenses: no client ever lists them directly (only via Kimpay expand),
    // so restrict listing to superusers.
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.listRule = null;
    app.save(expenses);

    // Participants: authenticated users still list their own linked participants
    // (used by the "recents" / account sync). Guests read co-participants via
    // the Kimpay expand (ViewRule), so listing others is not required.
    const participants = app.findCollectionByNameOrId("participants");
    participants.listRule = "user = @request.auth.id";
    app.save(participants);
}, (app) => {
    // Revert to the previous (permissive) listing rules.
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.listRule = "";
    app.save(expenses);

    const participants = app.findCollectionByNameOrId("participants");
    participants.listRule = "";
    app.save(participants);
});
