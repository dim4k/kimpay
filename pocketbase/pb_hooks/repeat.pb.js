/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Repeated expenses (rent, subscriptions): the copies due are
// made every hour, a few minutes past, so a copy dated today is there early
// in the morning in Europe. See lib/repeat.js.
//
// Superusers can run it at once: POST /api/crons/repeat_expenses (e2e tests).
// =============================================================================

cronAdd("repeat_expenses", "7 * * * *", () => {
    try {
        require(`${__hooks}/lib/repeat.js`).run($app);
    } catch (e) {
        $app.logger().error("repeat: run failed", "error", String(e));
    }
});
