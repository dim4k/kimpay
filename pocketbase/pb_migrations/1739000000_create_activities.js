migrate((app) => {
    // =========================================================================
    // activities: what happened in a group, who did it and when (the group's
    // history). Written by hooks only (see pb_hooks/activity.pb.js), read
    // through GET /api/kimpay/{id}/activity: every API rule stays closed.
    //
    //   action      what happened (see `values`)
    //   actor       participant who did it ("" when unknown); text, not a
    //               relation: the participant may be deleted since
    //   actor_name  their name at that time
    //   target      the expense or participant concerned (text, same reason)
    //   data        what the line shows: description, amount, names, and the
    //               values before / after a change
    // =========================================================================

    const kimpays = app.findCollectionByNameOrId("kimpays");

    const collection = new Collection({
        name: "activities",
        type: "base",
        indexes: ["CREATE INDEX idx_activities_kimpay_created ON activities (kimpay, created)"],
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
    });

    collection.fields.add(new RelationField({
        name: "kimpay",
        required: true,
        collectionId: kimpays.id,
        cascadeDelete: true,
        maxSelect: 1,
    }));
    collection.fields.add(new SelectField({
        name: "action",
        required: true,
        maxSelect: 1,
        values: [
            "expense_created",
            "expense_updated",
            "expense_deleted",
            "reimbursement_created",
            "reimbursement_deleted",
            "participant_added",
            "participant_renamed",
            "participant_deleted",
            "participants_merged",
        ],
    }));
    collection.fields.add(new TextField({ name: "actor", max: 15 }));
    collection.fields.add(new TextField({ name: "actor_name", max: 64 }));
    collection.fields.add(new TextField({ name: "target", max: 15 }));
    collection.fields.add(new JSONField({ name: "data", maxSize: 20000 }));
    collection.fields.add(new AutodateField({ name: "created", onCreate: true }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("activities");
    if (collection) app.delete(collection);
});
