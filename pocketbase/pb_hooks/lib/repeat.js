/// <reference path="../../pb_data/types.d.ts" />

// =============================================================================
// Repeated expenses: the copies due, made by the `repeat_expenses` cron
// (see repeat.pb.js and the 1740000008-9 migrations), every week, two weeks,
// month, quarter or year (`repeat_every`).
//
//   const repeat = require(`${__hooks}/lib/repeat.js`);
//   repeat.run($app);
//
// The dates are calendar days ("YYYY-MM-DD"), stored at UTC midnight like
// the app does. The same rule as app/src/lib/repeat.ts.
// =============================================================================

/** Copies older than this are not made any more (a server down for long, a date set by hand). */
var MAX_LATE_DAYS = 62;

/** Days between two copies (weeks), or months (the others). */
var STEPS = {
    week: { days: 7 },
    two_weeks: { days: 14 },
    month: { months: 1 },
    quarter: { months: 3 },
    year: { months: 12 },
};

var DAY_MS = 86400000;

function pad(n) {
    return (n < 10 ? "0" : "") + n;
}

/** "YYYY-MM-DD" of `day` in a month (the last day when the month is shorter). */
function anchored(year, month, day) {
    var y = year + Math.floor(month / 12);
    var m = ((month % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return y + "-" + pad(m + 1) + "-" + pad(Math.min(day, last));
}

/** The frequency of an expense set to repeat (monthly when not said, as before there was a choice). */
function frequency(every) {
    return Object.prototype.hasOwnProperty.call(STEPS, every) ? every : "month";
}

/**
 * The first date of the series after `from` and after `after` ("YYYY-MM-DD",
 * compared as text): on `day` of the month, or the weekday of `from`.
 */
function nextDate(from, day, after, every) {
    var step = STEPS[frequency(every)];
    if (step.days) {
        var start = Date.parse(from + "T00:00:00Z");
        var late = Math.max(0, Math.floor((Date.parse(after + "T00:00:00Z") - start) / DAY_MS));
        var count = Math.floor(late / step.days) + 1;
        return new Date(start + count * step.days * DAY_MS).toISOString().slice(0, 10);
    }
    var year = Number(from.slice(0, 4));
    var month = Number(from.slice(5, 7)) - 1;
    for (var i = 1; i < 1200; i++) {
        var candidate = anchored(year, month + i * step.months, day);
        if (candidate > from && candidate > after) return candidate;
    }
    return "";
}

/** "YYYY-MM-DD" a number of days before `day`. */
function daysBefore(day, days) {
    var date = new Date(day + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
}

/** EUR-based rates of a day (as the app), null when they cannot be had. */
function fetchRates(day, today) {
    var version = day >= today ? "latest" : day;
    var urls = [
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@" + version + "/v1/currencies/eur.min.json",
        "https://" + version + ".currency-api.pages.dev/v1/currencies/eur.min.json",
    ];
    for (var i = 0; i < urls.length; i++) {
        try {
            var res = $http.send({ url: urls[i], method: "GET", timeout: 10 });
            if (res.statusCode === 200) return JSON.parse(res.raw).eur || null;
        } catch (err) {
            // The next mirror.
        }
    }
    return null;
}

/** Expense currency -> group currency on a day; 0 when unknown (today's rate is then used). */
function rateOn(app, ratesByDay, record, day, today) {
    var from = record.getString("currency").toLowerCase();
    var to = "";
    try {
        to = app.findRecordById("kimpays", record.getString("kimpay")).getString("currency").toLowerCase();
    } catch (err) {
        return 0;
    }
    if (!from || !to || from === to) return 0;
    if (!(day in ratesByDay)) ratesByDay[day] = fetchRates(day, today);
    var rates = ratesByDay[day];
    if (!rates) return 0;
    var fromRate = from === "eur" ? 1 : rates[from];
    var toRate = to === "eur" ? 1 : rates[to];
    return fromRate && toRate ? toRate / fromRate : 0;
}

/**
 * Make the copies due of one expense, in one transaction: each copy takes
 * over the repetition. Returns how many were made.
 */
function repeatOne(app, id, today, ratesByDay) {
    var activity = require(__hooks + "/lib/activity.js");
    var made = 0;
    app.runInTransaction(function (txApp) {
        var source = txApp.findRecordById("expenses", id);
        // At most 12 copies at once, whatever the data says.
        for (var guard = 0; guard < 12; guard++) {
            var day = source.getInt("repeat_day");
            var every = frequency(source.getString("repeat_every"));
            var next = source.getString("repeat_next").slice(0, 10);
            if (day < 1 || day > 31 || !next || next > today || source.getBool("is_reimbursement")) return;

            if (next < daysBefore(today, MAX_LATE_DAYS)) {
                // Too late to be useful: on to the next one to come.
                source.set("repeat_next", nextDate(next, day, today, every) + " 00:00:00.000Z");
                txApp.save(source);
                return;
            }

            var copy = new Record(source.collection());
            [
                "kimpay", "description", "amount", "currency", "payer", "involved",
                "is_income", "icon", "notes", "created_by",
            ].forEach(function (field) {
                copy.set(field, source.get(field));
            });
            copy.set("split", JSON.parse(source.getString("split") || "null"));
            copy.set("is_reimbursement", false);
            copy.set("date", next + " 00:00:00.000Z");
            copy.set("exchange_rate", rateOn(txApp, ratesByDay, source, next, today));
            copy.set("repeat_day", day);
            copy.set("repeat_every", every);
            copy.set("repeat_next", nextDate(next, day, next, every) + " 00:00:00.000Z");
            copy.set("repeat_of", source.id);
            txApp.save(copy);

            source.set("repeat_day", 0);
            source.set("repeat_next", "");
            txApp.save(source);

            activity.log(txApp, copy.getString("kimpay"), "expense_repeated", { id: "", name: "" }, copy.id, activity.expenseData(txApp, copy));
            made++;
            source = copy;
        }
    });
    return made;
}

/** Every copy due today (UTC), expense by expense: one failing does not stop the others. */
function run(app) {
    var today = new Date().toISOString().slice(0, 10);
    var due = app.findRecordsByFilter(
        "expenses",
        "repeat_day > 0 && repeat_next != '' && repeat_next <= {:end} && is_reimbursement = false",
        "repeat_next",
        500,
        0,
        { end: today + " 23:59:59.999Z" },
    );
    var ratesByDay = {};
    var made = 0;
    for (var i = 0; i < due.length; i++) {
        try {
            made += repeatOne(app, due[i].id, today, ratesByDay);
        } catch (err) {
            app.logger().error("repeat: expense not copied", "id", due[i].id, "error", String(err));
        }
    }
    if (made > 0) app.logger().info("repeat: expenses copied", "count", made);
    return made;
}

module.exports = {
    anchored: anchored,
    frequency: frequency,
    nextDate: nextDate,
    run: run,
};
