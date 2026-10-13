/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Read-only summary of a Kimpay, reached through its `readonly_token`.
//
// SECURITY: the Kimpay ID is a write capability (anyone holding it can edit
// the group), and participant / expense records are publicly viewable by ID,
// their `kimpay` field included. So this endpoint must never return a real
// record ID: participants are renamed "p0", "p1"... and expenses get no ID.
// Avatars and photos are left out for the same reason (file URLs contain
// record IDs). Payment handles too: a summary is for reading, not paying.
// =============================================================================

routerAdd("GET", "/api/readonly/{token}", (e) => {
    const token = String(e.request.pathValue("token") || "");
    if (!/^[A-Za-z0-9-]{32,64}$/.test(token)) {
        return e.json(404, { message: "Not found" });
    }

    // 60 requests per minute per IP: enough to browse, too few to guess tokens.
    const { checkRateLimit } = require(`${__hooks}/lib/rateLimit.js`);
    if (!checkRateLimit(`readonly_${e.realIP()}`, 60, 60 * 1000)) {
        return e.json(429, { message: "Too many requests. Please wait a minute." });
    }

    let kimpay;
    try {
        kimpay = $app.findFirstRecordByFilter("kimpays", "readonly_token = {:token}", { token: token });
    } catch (err) {
        return e.json(404, { message: "Not found" });
    }

    try {
        // Go slices -> plain JS arrays (for map / forEach).
        const toArray = (list) => {
            const result = [];
            for (let i = 0; i < list.length; i++) result.push(list[i]);
            return result;
        };
        const participants = toArray($app.findRecordsByFilter(
            "participants", "kimpay = {:id}", "created", 0, 0, { id: kimpay.id },
        ));
        const expenses = toArray($app.findRecordsByFilter(
            "expenses", "kimpay = {:id}", "-date,-created", 0, 0, { id: kimpay.id },
        ));

        const refs = {};
        participants.forEach((p, i) => (refs[p.id] = "p" + i));
        const ref = (id) => refs[id] || "";

        const parseSplit = (record) => {
            try {
                const split = JSON.parse(record.getString("split") || "null");
                if (!split || typeof split.mode !== "string") return null;
                const values = {};
                for (const id in split.values || {}) {
                    if (refs[id]) values[refs[id]] = Number(split.values[id]) || 0;
                }
                return { mode: split.mode, values: values };
            } catch (err) {
                return null;
            }
        };

        return e.json(200, {
            kimpay: {
                name: kimpay.getString("name"),
                icon: kimpay.getString("icon"),
                currency: kimpay.getString("currency"),
            },
            participants: participants.map((p) => ({
                ref: ref(p.id),
                name: p.getString("name"),
            })),
            expenses: expenses.map((x) => ({
                description: x.getString("description"),
                amount: x.getFloat("amount"),
                currency: x.getString("currency"),
                exchange_rate: x.getFloat("exchange_rate"),
                date: x.getString("date"),
                icon: x.getString("icon"),
                payer: ref(x.getString("payer")),
                involved: toArray(x.getStringSlice("involved")).map(ref).filter((r) => r),
                split: parseSplit(x),
                is_reimbursement: x.getBool("is_reimbursement"),
                is_income: x.getBool("is_income"),
            })),
        });
    } catch (err) {
        console.error("Read-only summary failed", String(err));
        return e.json(500, { message: "Internal server error" });
    }
});
