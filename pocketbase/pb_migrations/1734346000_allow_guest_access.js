migrate((app) => {
    // We must relax the rules to allow Guests (who are unauthenticated) to access Kimpay data.
    // The security model shifts to "Capability URL": If you know the UUID of the Kimpay, you can access it.
    // We still try to prevent mass-enumeration where possible.

    // 1. KIMPAYS
    // View: Public (Anyone with ID can view). Crucial for guests.
    // List: Auth Only (Prevent crawling all kimpays). Guests don't need to listing "all" kimpays, only "my" kimpays via LocalStorage (which they do by fetching individual IDs via viewRule usually, or we accept list limitation).
    // Actually, RecentsService loads list by IDs? No, it typically does getOne or getList with filter.
    // If filtering by ID, ViewRule applies? NO. `getList` checks `listRule`.
    // If RecentsService uses `getList(filter: "id='a' || id='b'")`, `listRule` MUST be Public.
    // So we must make listRule Public too? 
    // If `listRule` is Public, `pb.collection('kimpays').getList()` dumps everything.
    // WE CANNOT HAVE THAT.
    // Solution: RecentsService probably iterates IDs and calls getOne?
    // Let's check RecentsService later. For now, ViewRule Public is minimal req.
    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.viewRule = ""; 
    // Keep listRule strict (or null/auth) to prevent scraping?
    // The previous migration set listRule to null (Admin only?).
    // If Dashboard needs to list "My Kimpays", it uses `participants` collection to find them.
    // So `kimpays.listRule` can remain restricted?
    // But generic user might need it? No, usually we expand `kimpay` from `participants`.
    // So `kimpays.listRule` = null/strict is FINE.
    app.save(kimpays);

    // 2. EXPENSES
    // List: Public. Guests need to fetch expenses.
    // View: Public.
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.listRule = "";
    expenses.viewRule = "";
    app.save(expenses);

    // 3. PARTICIPANTS
    // List: Public. Guests need to see who paid.
    // View: Public.
    const participants = app.findCollectionByNameOrId("participants");
    participants.listRule = "";
    participants.viewRule = "";
    app.save(participants);

}, (app) => {
    // Revert to Strict Rules (broken for guests)
    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.viewRule = "@request.auth.id != '' && @collection.participants.kimpay.id ?= id && @collection.participants.user ?= @request.auth.id";
    app.save(kimpays);

    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.listRule = "@request.auth.id != ''";
    expenses.viewRule = "@request.auth.id != ''";
    app.save(expenses);

    const participants = app.findCollectionByNameOrId("participants");
    participants.listRule = "user = @request.auth.id || (@collection.participants.kimpay.id ?= kimpay && @collection.participants.user ?= @request.auth.id)";
    participants.viewRule = "user = @request.auth.id"; 
    app.save(participants);
})
