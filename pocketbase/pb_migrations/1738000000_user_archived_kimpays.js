migrate((app) => {
    // =========================================================================
    // Users
    //   - archived_kimpays: IDs of the groups the user archived (done with:
    //     folded under "Archived" on the home page). Personal, no effect on
    //     the other members; kept on the account so it follows the user from
    //     one device to the next. Null until the user archives a first group.
    // =========================================================================

    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new JSONField({ name: "archived_kimpays", maxSize: 20000 }));
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("archived_kimpays");
    app.save(users);
});
