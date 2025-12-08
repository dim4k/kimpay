migrate((app) => {
  const KIMPAYS_ID = "kimpays00000000";
  const PARTICIPANTS_ID = "participants000";

  // --- Helper to add fields ---
  const addFields = (collection, fields) => {
      fields.forEach(f => collection.fields.add(f));
  };

  // --- Helper for system fields ---
  const getSystemFields = () => [
      new AutodateField({ name: "created", onCreate: true }),
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true })
  ];

  // Step 1: Create kimpays
  const kimpays = new Collection({
    id: KIMPAYS_ID,
    name: "kimpays",
    type: "base",
    indexes: [
      "CREATE UNIQUE INDEX idx_invite_token ON kimpays (invite_token)"
    ],
    createRule: "",
    updateRule: "",
    deleteRule: "",
    viewRule: ""
  });
  
  addFields(kimpays, [
      new TextField({ name: "name", required: true }),
      new TextField({ name: "invite_token", required: true }),
      new TextField({ name: "icon", max: 10 }),
      ...getSystemFields()
  ]);

  app.save(kimpays);
  
  // Step 2: Create participants
  const participants = new Collection({
    id: PARTICIPANTS_ID,
    name: "participants",
    type: "base",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    viewRule: ""
  });

  addFields(participants, [
      new TextField({ name: "name", required: true }),
      new TextField({ name: "local_id" }),
      new FileField({
        name: "avatar",
        maxSelect: 1, 
        maxSize: 52428800,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"]
      }),
      new RelationField({
        name: "kimpay",
        required: true,
        collectionId: KIMPAYS_ID,
        cascadeDelete: true,
        maxSelect: 1
      }),
      ...getSystemFields()
  ]);
  
  app.save(participants);
  
  // Step 3: Create expenses
  const expenses = new Collection({
    name: "expenses",
    type: "base",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    viewRule: ""
  });

  addFields(expenses, [
      new TextField({ name: "description", required: true }),
      new NumberField({ name: "amount", required: true }),
      new DateField({ name: "date", required: true }),
      new FileField({
        name: "photos",
        maxSelect: 20, 
        maxSize: 52428800,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"]
      }),
      new TextField({ name: "icon", max: 10 }),
      new RelationField({
        name: "kimpay",
        required: true,
        collectionId: KIMPAYS_ID,
        cascadeDelete: true,
        maxSelect: 1
      }),
      new RelationField({
        name: "payer",
        required: true,
        collectionId: PARTICIPANTS_ID,
        cascadeDelete: false,
        maxSelect: 1
      }),
      new RelationField({
        name: "created_by",
        collectionId: PARTICIPANTS_ID,
        cascadeDelete: false,
        maxSelect: 1
      }),
      new RelationField({
        name: "involved",
        collectionId: PARTICIPANTS_ID,
        cascadeDelete: false,
        maxSelect: 50
      }),
      ...getSystemFields()
  ]);
  
  app.save(expenses);

  // Step 4: Add created_by to kimpays
  try {
      const kimpaysRef = app.findCollectionByNameOrId(KIMPAYS_ID);
      kimpaysRef.fields.add(new RelationField({
        name: "created_by",
        collectionId: PARTICIPANTS_ID,
        cascadeDelete: false,
        maxSelect: 1
      }));
      app.save(kimpaysRef);
  } catch (e) {
      console.log("Error adding created_by to kimpays", e);
  }

}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("expenses")); } catch(e) {}
  try { app.delete(app.findCollectionByNameOrId("participants")); } catch(e) {}
  try { app.delete(app.findCollectionByNameOrId("kimpays")); } catch(e) {}
})
