import { STORAGE_KEYS } from "#lib/constants.js";
import { auth } from "#lib/stores/auth.svelte.js";
import { userService } from "#lib/services/user.js";
import { prefs } from "#lib/utils/prefs.js";

/**
 * The groups I archived (done with them: folded on the home page). Personal:
 * nothing changes for the other members. On this device, and on the account
 * when logged in, which then follows me from one device to the next.
 */
class ArchiveStore {
    private local = $state<string[]>(prefs.getJSON<string[]>(STORAGE_KEYS.ARCHIVED_KIMPAYS) ?? []);

    /** The account's list once it has one, this device's otherwise. */
    ids = $derived<string[]>(Array.isArray(auth.user?.archived_kimpays) ? auth.user!.archived_kimpays! : this.local);

    has(id: string): boolean {
        return this.ids.includes(id);
    }

    /**
     * On login: the groups archived on this device without the account are
     * added to the account's.
     */
    async mergeIntoAccount() {
        const user = auth.user;
        if (!user) return;
        const account = Array.isArray(user.archived_kimpays) ? user.archived_kimpays : [];
        const extra = this.local.filter((id) => !account.includes(id));
        if (extra.length === 0) return;
        auth.setUser(await userService.updateArchived(user.id, [...account, ...extra]));
    }

    /**
     * On logout: this device keeps the account's list (archived elsewhere
     * included), without the groups removed from it.
     */
    keepOnDevice(removed: string[] = []) {
        this.local = this.ids.filter((id) => !removed.includes(id));
        prefs.setJSON(STORAGE_KEYS.ARCHIVED_KIMPAYS, this.local);
    }

    async set(id: string, archived: boolean) {
        const next = archived ? [...new Set([...this.ids, id])] : this.ids.filter((x) => x !== id);
        this.local = next;
        prefs.setJSON(STORAGE_KEYS.ARCHIVED_KIMPAYS, next);

        const user = auth.user;
        if (!user) return;
        // Shown at once; restored if the account refuses it.
        auth.setUser({ ...user, archived_kimpays: next });
        try {
            auth.setUser(await userService.updateArchived(user.id, next));
        } catch (e) {
            auth.setUser(user);
            throw e;
        }
    }
}

export const archiveStore = new ArchiveStore();
