/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Merge two participants of a Kimpay: the same person, added twice ("Pierre"
// by the creator, "Pierre M." when opening the link). Everything of `from`
// passes to `into`, then `from` is deleted. In one transaction.
//
// Balances do not change: `into` takes the payments and shares of `from`.
// - payer / created_by: `from` becomes `into`
// - involved: `from` becomes `into` (once). An equal split where both were
//   involved counted that person twice: it becomes 2 shares for `into`, 1 for
//   the others. Custom splits add the values of `from` to those of `into`.
// - a reimbursement between the two is deleted (paid to oneself).
//
// SECURITY: a hook bypasses the API rules, so the collections' own rules are
// applied to every record written (they follow any later change of those
// rules). A participant linked to an account is only merged by that account,
// like its updateRule; two accounts are never merged.
// =============================================================================

routerAdd("POST", "/api/kimpay/{id}/merge", (e) => {
    const id = String(e.request.pathValue("id") || "");
    const body = JSON.parse(JSON.stringify(e.requestInfo().body || {}));
    const isId = (v) => typeof v === "string" && /^[a-z0-9]{15}$/.test(v);
    const notFound = () => e.json(404, { message: "Not found" });
    const forbidden = () => e.json(403, { message: "Forbidden" });

    if (!/^[a-zA-Z0-9]{15}$/.test(id) || !isId(body.from) || !isId(body.into) || body.from === body.into) {
        return e.json(400, { message: "Invalid body" });
    }

    let from, into;
    try {
        from = e.app.findRecordById("participants", body.from);
        into = e.app.findRecordById("participants", body.into);
    } catch (err) {
        return notFound();
    }
    if (from.getString("kimpay") !== id || into.getString("kimpay") !== id) return notFound();

    const info = e.requestInfo();
    const allowed = (record, rule) => {
        try {
            return e.app.canAccessRecord(record, info, rule);
        } catch (err) {
            return false; // Invalid rule or db error: deny
        }
    };
    if (!allowed(from, from.collection().deleteRule)) return forbidden();

    const callerId = e.auth && e.auth.collection().name === "users" ? e.auth.id : "";
    const fromUser = from.getString("user");
    const intoUser = into.getString("user");
    if (fromUser && fromUser !== callerId) return forbidden();
    if (fromUser && intoUser && fromUser !== intoUser) return e.json(400, { message: "Two accounts" });

    const expenses = e.app.findRecordsByFilter(
        "expenses",
        "kimpay = {:id} && (payer = {:from} || created_by = {:from} || involved ~ {:from})",
        "",
        0,
        0,
        { id: id, from: body.from },
    );
    for (let i = 0; i < expenses.length; i++) {
        if (!allowed(expenses[i], expenses[i].collection().updateRule)) return forbidden();
    }

    const swap = (value) => (value === body.from ? body.into : value);
    const activity = require(`${__hooks}/lib/activity.js`);
    const actor = activity.actorOf(e, id);
    const names = { from: from.getString("name"), into: into.getString("name") };

    e.app.runInTransaction((txApp) => {
        for (let i = 0; i < expenses.length; i++) {
            const expense = expenses[i];
            const involved = expense.getStringSlice("involved");
            const wasInvolved = involved.indexOf(body.from) !== -1;
            const bothInvolved = wasInvolved && involved.indexOf(body.into) !== -1;

            const merged = [];
            for (let j = 0; j < involved.length; j++) {
                const p = swap(involved[j]);
                if (merged.indexOf(p) === -1) merged.push(p);
            }
            const payer = swap(expense.getString("payer"));

            // Paid to oneself: nothing left to record.
            if (expense.getBool("is_reimbursement") && merged.length === 1 && merged[0] === payer) {
                txApp.delete(expense);
                continue;
            }

            const raw = expense.getString("split");
            let split = raw && raw !== "null" ? JSON.parse(raw) : null;
            if (wasInvolved && split && split.mode && split.mode !== "equal" && split.values) {
                const values = split.values;
                const sum = (Number(values[body.into]) || 0) + (Number(values[body.from]) || 0);
                values[body.into] = Math.round(sum * 100) / 100;
                delete values[body.from];
            } else if (bothInvolved) {
                const values = {};
                for (let j = 0; j < merged.length; j++) values[merged[j]] = 1;
                values[body.into] = 2;
                split = { mode: "shares", values: values };
            }

            expense.set("payer", payer);
            expense.set("involved", merged);
            expense.set("created_by", swap(expense.getString("created_by")));
            if (split) expense.set("split", split);
            txApp.save(expense);
        }

        // The account follows the person.
        if (fromUser && !intoUser) {
            into.set("user", fromUser);
            txApp.save(into);
        }

        const kimpay = txApp.findRecordById("kimpays", id);
        if (kimpay.getString("created_by") === body.from) {
            kimpay.set("created_by", body.into);
            txApp.save(kimpay);
        }

        txApp.delete(txApp.findRecordById("participants", body.from));
    });

    activity.log(e.app, id, "participants_merged", actor, body.into, names);
    return e.json(200, { id: body.into });
});
