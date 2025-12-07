/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);

  try {
      // 1. Update Expenses Photos
      const expenses = dao.findCollectionByNameOrId("expenses");
      const photosField = expenses.schema.getFieldByName("photos");
      photosField.options.maxSize = 52428800; // 50MB
      photosField.options.mimeTypes = []; // Allow all types (or at least remove restriction)
      
      // Also update maxSelect if needed (it was 10)
      photosField.options.maxSelect = 20;
  
      dao.saveCollection(expenses);
  } catch(e) {
      console.log("Could not update expenses collection (maybe doesn't exist yet?)", e);
  }

  try {
      // 2. Update Participants Avatar
      const participants = dao.findCollectionByNameOrId("participants");
      const avatarField = participants.schema.getFieldByName("avatar");
      avatarField.options.maxSize = 20971520; // 20MB
      avatarField.options.mimeTypes = []; 
  
      dao.saveCollection(participants);
  } catch(e) {
      console.log("Could not update participants collection", e);
  }

}, (db) => {
  // Optional revert logic
})
