/// <reference path="../pocketbase/pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);

  // Create kimpays collection
  const kimpays = new Collection({
    name: "kimpays",
    type: "base",
    schema: [
      {
        name: "name",
        type: "text",
        required: true
      },
      {
        name: "invite_token",
        type: "text",
        required: true
      },
      {
        name: "icon",
        type: "text",
        required: false,
        options: { max: 10 }
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_invite_token ON kimpays (invite_token)"
    ],
    listRule: "id != ''",
    viewRule: "id != ''",
    createRule: "id != ''",
    updateRule: "id != ''",
    deleteRule: "id != ''"
  });

  // Create participants collection
  const participants = new Collection({
    name: "participants",
    type: "base",
    schema: [
      {
        name: "name",
        type: "text",
        required: true
      },
      {
        name: "local_id",
        type: "text",
        required: false
      },
      {
        name: "avatar",
        type: "file",
        required: false,
        options: {
          maxSelect: 1,
          maxSize: 0,
          mimeTypes: ["image/jpeg", "image/png", "image/webp"]
        }
      },
      {
        name: "kimpay",
        type: "relation",
        required: true,
        options: {
          collectionId: kimpays.id,
          cascadeDelete: true
        }
      }
    ],
    listRule: "id != ''",
    viewRule: "id != ''",
    createRule: "id != ''",
    updateRule: "id != ''",
    deleteRule: "id != ''"
  });

  // Create expenses collection
  const expenses = new Collection({
    name: "expenses",
    type: "base",
    schema: [
      {
        name: "description",
        type: "text",
        required: true
      },
      {
        name: "amount",
        type: "number",
        required: true
      },
      {
        name: "date",
        type: "date",
        required: true
      },
      {
        name: "photos",
        type: "file",
        required: false,
        options: {
          maxSelect: 10,
          maxSize: 0,
          mimeTypes: ["image/jpeg", "image/png", "image/webp"]
        }
      },
      {
        name: "icon",
        type: "text",
        required: false,
        options: { max: 10 }
      },
      {
        name: "kimpay",
        type: "relation",
        required: true,
        options: {
          collectionId: kimpays.id,
          cascadeDelete: true
        }
      },
      {
        name: "payer",
        type: "relation",
        required: true,
        options: {
          collectionId: participants.id,
          cascadeDelete: false
        }
      },
      {
        name: "created_by",
        type: "relation",
        required: false,
        options: {
          collectionId: participants.id,
          cascadeDelete: false
        }
      },
      {
        name: "involved",
        type: "relation",
        required: false,
        options: {
          collectionId: participants.id,
          cascadeDelete: false,
          maxSelect: 50
        }
      }
    ],
    listRule: "id != ''",
    viewRule: "id != ''",
    createRule: "id != ''",
    updateRule: "id != ''",
    deleteRule: "id != ''"
  });

  dao.saveCollection(kimpays);
  dao.saveCollection(participants);
  dao.saveCollection(expenses);

  return null;
}, (db) => {
  const dao = new Dao(db);
  
  dao.deleteCollection(dao.findCollectionByNameOrId("expenses"));
  dao.deleteCollection(dao.findCollectionByNameOrId("participants"));
  dao.deleteCollection(dao.findCollectionByNameOrId("kimpays"));
  
  return null;
})
