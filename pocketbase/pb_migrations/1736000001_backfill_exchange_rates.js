migrate((app) => {
    // =========================================================================
    // Freeze the exchange rate of existing foreign-currency expenses at their
    // date, so their balances stop moving with today's rates.
    //
    // Historical rates come from the same free API as the app (base EUR, one
    // file per day). Best effort: when the API cannot be reached (no network,
    // isolated test stack...) the backfill stops, and those expenses keep
    // using today's rate, exactly as before.
    //
    // Written with plain SQL: going through app.save() would run the realtime
    // "touch" hooks once per expense.
    // =========================================================================

    const rows = arrayOf(new DynamicModel({ id: "", currency: "", date: "", kimpay_currency: "" }));
    try {
        app.db()
            .newQuery(
                "SELECT e.id AS id, e.currency AS currency, e.date AS date, k.currency AS kimpay_currency " +
                "FROM expenses e JOIN kimpays k ON k.id = e.kimpay " +
                "WHERE e.currency != '' AND k.currency != '' AND e.currency != k.currency " +
                "AND (e.exchange_rate IS NULL OR e.exchange_rate = 0)",
            )
            .all(rows);
    } catch (e) {
        console.log("Exchange rate backfill: query failed", e);
        return;
    }
    if (rows.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const ratesByDate = {};

    /** EUR-based rates for a day, null when unavailable, throws when offline. */
    function fetchRates(day) {
        const version = day >= today ? "latest" : day;
        const urls = [
            "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@" + version + "/v1/currencies/eur.min.json",
            "https://" + version + ".currency-api.pages.dev/v1/currencies/eur.min.json",
        ];
        let reached = false;
        for (let i = 0; i < urls.length; i++) {
            try {
                const res = $http.send({ url: urls[i], method: "GET", timeout: 10 });
                reached = true;
                if (res.statusCode === 200) return JSON.parse(res.raw).eur || null;
            } catch (e) {
                // Try the next mirror.
            }
        }
        if (!reached) throw new Error("rates API unreachable");
        return null;
    }

    let updated = 0;
    try {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const day = String(row.date).slice(0, 10);
            if (!(day in ratesByDate)) ratesByDate[day] = fetchRates(day);
            const rates = ratesByDate[day];
            if (!rates) continue;

            const from = row.currency.toLowerCase();
            const to = row.kimpay_currency.toLowerCase();
            const fromRate = from === "eur" ? 1 : rates[from];
            const toRate = to === "eur" ? 1 : rates[to];
            if (!fromRate || !toRate) continue;

            app.db()
                .newQuery("UPDATE expenses SET exchange_rate = {:rate} WHERE id = {:id}")
                .bind({ rate: toRate / fromRate, id: row.id })
                .execute();
            updated++;
        }
    } catch (e) {
        console.log("Exchange rate backfill stopped:", String(e));
    }
    console.log("Exchange rate backfill: " + updated + "/" + rows.length + " expenses updated");
}, (app) => {
    // Nothing to undo: rates are dropped with the field itself.
});
