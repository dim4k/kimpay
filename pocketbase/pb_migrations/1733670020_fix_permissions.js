migrate((app) => {
  const collections = ["kimpays", "participants", "expenses"];

  for (const name of collections) {
      try {
          const collection = app.findCollectionByNameOrId(name);
          
          // Open up CRUD permissions (public)
          // Listing is kept restricted (null) to prevent scraping, unless needed.
          // Viewing is public (if you have the ID).
          collection.createRule = "";
          collection.updateRule = "";
          collection.deleteRule = "";
          collection.viewRule = "";
          
          app.save(collection);
      } catch (e) {
          console.log(`Failed to update rules for ${name}`, e);
      }
  }
}, (app) => {
  // Optional revert: set back to null?
})
