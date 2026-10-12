/// <reference path="../../pb_data/types.d.ts" />

/**
 * Gives a participant the photo of its account (none when the account has
 * none). Saved without the API rules: the hooks calling it already checked
 * who changed what.
 */
function copyAccountPhoto(app, user, participant) {
    const filename = user.get("avatar");
    if (!filename) {
        if (!participant.get("avatar")) return;
        participant.set("avatar", null);
        app.save(participant);
        return;
    }

    const fsys = app.newFilesystem();
    try {
        const file = fsys.getReuploadableFile(`${user.baseFilesPath()}/${filename}`, false);
        participant.set("avatar", file);
        app.save(participant);
    } catch (err) {
        console.error("[avatar] Could not copy the photo of", user.id, "to", participant.id, err);
    } finally {
        fsys.close();
    }
}

module.exports = { copyAccountPhoto };
