migrate((app) => {
    // Relax view/list rules to support guests (unauthenticated users).
    // Security model: "Capability URL" — knowing a Kimpay's UUID grants access.
    // Mass-enumeration is still limited where possible.

    // 1. KIMPAYS
    // View: public (anyone with the ID can read it) — required for guests.
    // List: left restricted (set elsewhere) to prevent scraping; clients reach
    // their Kimpays by ID/expand, never by listing the whole collection.
    const kimpays = app.findCollectionByNameOrId("kimpays");
    kimpays.viewRule = "";
    app.save(kimpays);

    // 2. EXPENSES — public view/list so guests can read a Kimpay's expenses.
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.listRule = "";
    expenses.viewRule = "";
    app.save(expenses);

    // 3. PARTICIPANTS — public view/list so guests can see who paid.
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
