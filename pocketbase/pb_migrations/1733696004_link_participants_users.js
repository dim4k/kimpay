migrate((app) => {
  // 1. Add 'user' relation to 'participants' collection
  const participants = app.findCollectionByNameOrId("participants");
  participants.fields.add(new RelationField({
    name: "user",
    collectionId: "_pb_users_auth_",
    cascadeDelete: false,
    maxSelect: 1
  }));
  
  // 3. Update participants update rule
  // Protect linked participants: Only the linked user can update.
  // Anonymous participants remain editable by anyone (public).
  participants.createRule = "user = '' || user = @request.auth.id";
  participants.updateRule = "user = '' || user = @request.auth.id";
  participants.listRule = "user = @request.auth.id";
  
  app.save(participants);

  // 2. Update kimpays delete rule
  const kimpays = app.findCollectionByNameOrId("kimpays");
  
  // Strict: Only authenticated owners can delete.
  // Anonymous kimpays cannot be deleted by anyone (except admin).
  kimpays.deleteRule = "@request.auth.id != '' && created_by.user = @request.auth.id";
  
  app.save(kimpays);

}, (app) => {
  const participants = app.findCollectionByNameOrId("participants");
  participants.fields.removeByName("user");
  participants.updateRule = ""; // Restore to public
  app.save(participants);

  const kimpays = app.findCollectionByNameOrId("kimpays");
  kimpays.deleteRule = ""; // Restore to public
  app.save(kimpays);
})
