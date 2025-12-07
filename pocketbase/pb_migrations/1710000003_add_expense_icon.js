migrate((app) => {
  const collection = app.findCollectionByNameOrId("expenses");

  collection.fields.add(new TextField({
    "name": "icon",
    "type": "text",
    "required": false,
    "presentable": false,
    "system": false,
    "id": "expense_icon",
    "max": 10 // Enough for a few emojis just in case
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("expenses");

  collection.fields.removeById("expense_icon");

  return app.save(collection);
})
