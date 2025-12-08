migrate((app) => {
  try {
      // 1. Update Expenses Photos
      const expenses = app.findCollectionByNameOrId("expenses");
      const photosField = expenses.fields.getByName("photos");
      
      // In v0.23+, field options are modified differently or same
      // Assuming fields.getByName() returns a reference we can modify
      if (photosField) {
        photosField.maxSize = 52428800; // 50MB
        photosField.mimeTypes = []; 
        photosField.maxSelect = 20;
        
        // Note: Field structure in JSVM might be flat or nested "options" depending on specific field type implementation.
        // But commonly properties like maxSize are directly on the file field struct or options struct.
        // Actually, FileField struct has MaxSize.
      }
  
      app.save(expenses);
  } catch(e) {
      console.log("Could not update expenses collection", e);
  }

  try {
      // 2. Update Participants Avatar
      const participants = app.findCollectionByNameOrId("participants");
      const avatarField = participants.fields.getByName("avatar");
      
      if (avatarField) {
        avatarField.maxSize = 20971520; // 20MB
        avatarField.mimeTypes = []; 
      }
  
      app.save(participants);
  } catch(e) {
      console.log("Could not update participants collection", e);
  }

}, (app) => {
  // Optional revert logic
})
