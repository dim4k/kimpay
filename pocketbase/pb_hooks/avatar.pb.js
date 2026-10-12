/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// One photo per person.
//
// A logged-in user has an account photo, and a participant in each group they
// joined. The account photo is the one they change (profile): it is copied to
// every participant linked to the account, and to a participant when it gets
// linked (claimed), so the other members see the same face everywhere.
// See lib/avatar.js.
// =============================================================================

onRecordAfterUpdateSuccess((e) => {
    if (e.record.get("avatar") !== e.record.original().get("avatar")) {
        const { copyAccountPhoto } = require(`${__hooks}/lib/avatar.js`);
        const participants = e.app.findRecordsByFilter("participants", "user = {:user}", "", 0, 0, { user: e.record.id });
        for (const participant of participants) {
            copyAccountPhoto(e.app, e.record, participant);
        }
    }
    e.next();
}, "users");

onRecordAfterUpdateSuccess((e) => {
    const userId = e.record.get("user");
    if (userId && userId !== e.record.original().get("user")) {
        const { copyAccountPhoto } = require(`${__hooks}/lib/avatar.js`);
        try {
            const user = e.app.findRecordById("users", userId);
            // A participant claimed by an account without a photo keeps its own.
            // A fresh copy is saved: saving `e.record` again would still see
            // the claim as a change, and run this hook in a loop.
            if (user.get("avatar")) copyAccountPhoto(e.app, user, e.app.findRecordById("participants", e.record.id));
        } catch (err) {
            console.error("[avatar] Could not copy the account photo", err);
        }
    }
    e.next();
}, "participants");
