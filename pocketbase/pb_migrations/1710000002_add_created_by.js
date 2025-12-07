migrate((app) => {
  const collection = app.findCollectionByNameOrId("kimpays");

  const participants = app.findCollectionByNameOrId("participants");

  collection.fields.add(new RelationField({
    "name": "created_by",
    "collectionId": participants.id,
    "cascadeDelete": false,
    "minSelect": 0,
    "maxSelect": 1,
    "displayFields": []
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("kimpays");
  collection.fields.removeById("created_by");
  return app.save(collection);
})
