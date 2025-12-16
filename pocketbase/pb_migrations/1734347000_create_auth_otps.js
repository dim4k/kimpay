migrate((app) => {
    const collection = new Collection({
        name: "auth_otps",
        type: "base",
        system: false,
        indexes: [
            "CREATE UNIQUE INDEX idx_otp_code ON auth_otps (code)"
        ],
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
    });

    collection.fields.add(new TextField({
        name: "code",
        required: true,
        present: true // 'unique' is handled by index, present ensures not empty
    }));

    collection.fields.add(new RelationField({
        name: "user",
        required: true,
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
    }));

    collection.fields.add(new DateField({
        name: "expires",
        required: true,
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("auth_otps");
    if (collection) {
        app.delete(collection);
    }
})
