/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Change the currency of a Kimpay, converting its expenses. In one transaction.
//
// Expenses keep their amount and currency: what changes is the rate that
// turns them into the group currency (`exchange_rate`, frozen at the expense
// date, 0 = unknown, today's rate is used). With `rate` = 1 old -> new, given
// by the app (today's rate):
// - in the old currency: rate
// - in the new currency: 0 (no conversion)
// - in a third currency with a frozen rate: frozen rate x rate
// - in a third currency without one: still today's rate, into the new currency
// Every balance is multiplied by `rate`: who is settled stays settled.
//
// SECURITY: a hook bypasses the API rules, so the collections' own rules are
// applied to every record written, like /api/kimpay/{id}/merge. The rate is
// the caller's word, as any amount they could already type in an expense.
// =============================================================================

routerAdd("POST", "/api/kimpay/{id}/currency", (e) => {
    const id = String(e.request.pathValue("id") || "");
    const body = JSON.parse(JSON.stringify(e.requestInfo().body || {}));
    const notFound = () => e.json(404, { message: "Not found" });
    const forbidden = () => e.json(403, { message: "Forbidden" });

    const to = typeof body.to === "string" ? body.to : "";
    const rate = Number(body.rate);
    if (!/^[a-zA-Z0-9]{15}$/.test(id) || !/^[A-Z]{3}$/.test(to)) {
        return e.json(400, { message: "Invalid body" });
    }

    let kimpay;
    try {
        kimpay = e.app.findRecordById("kimpays", id);
    } catch (err) {
        return notFound();
    }

    const info = e.requestInfo();
    const allowed = (record, rule) => {
        try {
            return e.app.canAccessRecord(record, info, rule);
        } catch (err) {
            return false; // Invalid rule or db error: deny
        }
    };
    if (!allowed(kimpay, kimpay.collection().viewRule)) return notFound();
    if (!allowed(kimpay, kimpay.collection().updateRule)) return forbidden();

    const from = kimpay.getString("currency") || "EUR";
    if (from === to) return e.json(200, { currency: to });

    const expenses = e.app.findRecordsByFilter("expenses", "kimpay = {:id}", "", 0, 0, { id: id });
    for (let i = 0; i < expenses.length; i++) {
        if (!allowed(expenses[i], expenses[i].collection().updateRule)) return forbidden();
    }

    const currencyOf = (expense) => expense.getString("currency") || "EUR";
    const needsRate = expenses.some((expense) => currencyOf(expense) !== to);
    if (needsRate && !(isFinite(rate) && rate > 1e-6 && rate < 1e6)) {
        return e.json(400, { message: "Invalid rate" });
    }
    const round = (value) => Math.round(value * 1e8) / 1e8;

    const activity = require(`${__hooks}/lib/activity.js`);
    const actor = activity.actorOf(e, id);

    e.app.runInTransaction((txApp) => {
        for (let i = 0; i < expenses.length; i++) {
            const expense = expenses[i];
            const currency = currencyOf(expense);
            const frozen = expense.getFloat("exchange_rate");
            let next;
            if (currency === to) next = 0;
            else if (currency === from) next = round(rate);
            else next = frozen > 0 ? round(frozen * rate) : 0;
            if (next === frozen) continue;
            expense.set("exchange_rate", next);
            txApp.save(expense);
        }

        const record = txApp.findRecordById("kimpays", id);
        record.set("currency", to);
        txApp.save(record);
    });

    activity.log(e.app, id, "currency_changed", actor, id, needsRate ? { from: from, to: to, rate: rate } : { from: from, to: to });
    return e.json(200, { currency: to });
});
