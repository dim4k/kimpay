migrate((app) => {
  // Update kimpays collection
  const kimpays = app.findCollectionByNameOrId("kimpays");
  kimpays.listRule = null; // Disable listing
  kimpays.viewRule = "";   // Allow viewing if ID is known (public)
  app.save(kimpays);

  // Update participants collection
  const participants = app.findCollectionByNameOrId("participants");
  participants.listRule = null; // Disable listing
  participants.viewRule = "";   // Allow viewing if ID is known
  app.save(participants);

  // Update expenses collection
  const expenses = app.findCollectionByNameOrId("expenses");
  expenses.listRule = null; // Disable listing
  expenses.viewRule = "";   // Allow viewing if ID is known
  app.save(expenses);
}, (app) => {
  const kimpays = app.findCollectionByNameOrId("kimpays");
  kimpays.listRule = "";
  app.save(kimpays);

  const participants = app.findCollectionByNameOrId("participants");
  participants.listRule = "";
  app.save(participants);

  const expenses = app.findCollectionByNameOrId("expenses");
  expenses.listRule = "";
  app.save(expenses);
})
