migrate((db) => {
  const dao = new Dao(db);

  // Update kimpays collection
  const kimpays = dao.findCollectionByNameOrId("kimpays");
  kimpays.listRule = null; // Disable listing
  kimpays.viewRule = "";   // Allow viewing if ID is known (public)
  dao.saveCollection(kimpays);

  // Update participants collection
  const participants = dao.findCollectionByNameOrId("participants");
  participants.listRule = null; // Disable listing
  participants.viewRule = "";   // Allow viewing if ID is known
  dao.saveCollection(participants);

  // Update expenses collection
  const expenses = dao.findCollectionByNameOrId("expenses");
  expenses.listRule = null; // Disable listing
  expenses.viewRule = "";   // Allow viewing if ID is known
  dao.saveCollection(expenses);

  return null;
}, (db) => {
  const dao = new Dao(db);

  const kimpays = dao.findCollectionByNameOrId("kimpays");
  kimpays.listRule = "";
  dao.saveCollection(kimpays);

  const participants = dao.findCollectionByNameOrId("participants");
  participants.listRule = "";
  dao.saveCollection(participants);

  const expenses = dao.findCollectionByNameOrId("expenses");
  expenses.listRule = "";
  dao.saveCollection(expenses);

  return null;
})
