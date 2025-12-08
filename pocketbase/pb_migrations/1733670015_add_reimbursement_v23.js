migrate((app) => {
  const collection = app.findCollectionByNameOrId("expenses");

  // In v0.23+, 'schema' is replaced by 'fields'.
  // We assume 'fields' has an 'add' method or is an array we can push to.
  // We construct the field object based on typical PB field structure.
  
  // Note: If 'BoolField' class is not global, we try passing a plain object with 'type' property.
  // PocketBase often handles unmarshaling from plain props.
  
  collection.fields.add(new BoolField({
    name: "is_reimbursement",
    required: false,
    presentable: false,
    system: false,
    id: "bool_is_reimbursement" 
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("expenses");
  
  // Assuming removeByName or similar exists, or getting by name and removing
  const field = collection.fields.getByName("is_reimbursement");
  if (field) {
      collection.fields.remove(field); 
      // or collection.fields.removeByName with string?
      // collection.fields.remove(field) is safer if we have the reference
  }
  
  app.save(collection);
})
