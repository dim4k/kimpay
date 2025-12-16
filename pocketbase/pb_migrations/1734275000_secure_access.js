migrate((app) => {
    // 1. KIMPAYS (Strict)
    // Only participants can view. Listing is disabled (Dashboard uses participants list to find kimpays).
    // Join page uses Cloud Function (Admin) to resolve token, so public view is NOT needed.
    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.listRule = null; 
    // View: User must be a participant in this kimpay
    kimpays.viewRule = "@request.auth.id != '' && @collection.participants.kimpay.id ?= id && @collection.participants.user ?= @request.auth.id";
    app.save(kimpays);

    // 2. EXPENSES (Strict)
    // Only participants of the kimpay can view/list expenses
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.listRule = "@request.auth.id != '' && @collection.participants.kimpay.id ?= kimpay && @collection.participants.user ?= @request.auth.id";
    expenses.viewRule = "@request.auth.id != '' && @collection.participants.kimpay.id ?= kimpay && @collection.participants.user ?= @request.auth.id";
    app.save(expenses);

    // 3. PARTICIPANTS (Strict)
    // Users can see:
    // a) Their own participant profiles (user = auth.id)
    // b) Co-participants in kimpays they belong to
    const participants = app.findCollectionByNameOrId("participants");
    const rule = "user = @request.auth.id || (@collection.participants.kimpay.id ?= kimpay && @collection.participants.user ?= @request.auth.id)";
    participants.listRule = rule;
    participants.viewRule = rule;
    // Update also restricts to self or maybe allow open for specific cases? 
    // Previous migration set update to owner only, stick with that.
    app.save(participants);

}, (app) => {
    // Revert to open permissions (inherited from previous state, effectively "public for view")
    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.listRule = null;
    kimpays.viewRule = ""; // Public
    app.save(kimpays);

    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.listRule = null;
    expenses.viewRule = ""; // Public
    app.save(expenses);
    
    const participants = app.findCollectionByNameOrId("participants");
    participants.listRule = "user = @request.auth.id"; // Previous strict rule
    app.save(participants);
})
