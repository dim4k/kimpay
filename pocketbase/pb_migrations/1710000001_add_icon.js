migrate((app) => {
  const collection = app.findCollectionByNameOrId("kimpays");

  collection.fields.add(new TextField({
    "name": "icon",
    "type": "text",
    "required": false,
    "presentable": false,
    "system": false,
    "id": "icon_field",
    "max": 10 // Enough for a few emojis just in case
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("kimpays");
  collection.fields.removeById("icon_field");
  return app.save(collection);
})
