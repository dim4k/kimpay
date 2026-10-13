import { pb } from '#lib/pocketbase.js';
import type { Participant } from '#lib/types.js';
import { STORAGE_KEYS } from '#lib/constants.js';
import { auth } from '#lib/stores/auth.svelte.js';
import { recentsStore } from '#lib/stores/recents.svelte.js';
import { archiveStore } from '#lib/stores/archive.svelte.js';
import { activeKimpayGlobal } from '#lib/stores/activeKimpayGlobal.svelte.js';
import { storageService } from '#lib/services/storage.js';
import { participantService } from '#lib/services/participant.js';
import { kimpayService } from '#lib/services/kimpay.js';
import { prefs } from '#lib/utils/prefs.js';

/**
 * Right after logging in on this device: the device's identities and the
 * groups it created go to the account (unless the account already is someone
 * in that group: the device then takes that identity), and so do the groups
 * archived here.
 */
export async function afterLogin() {
    const user = auth.user;
    if (!user) return;

    for (const kimpayId of await storageService.getRecentKimpayIds()) {
        const participantId = await storageService.getMyParticipantId(kimpayId);
        if (!participantId) continue;

        try {
            const mine = await participantService.linkToAccount(participantId, kimpayId, user.id);
            if (mine !== participantId) await useIdentity(kimpayId, mine);
        } catch (e) {
            console.error("Failed to link the identity to the account", kimpayId, e);
        }
        try {
            await kimpayService.claimOwnership(kimpayId);
        } catch (e) {
            console.error("Failed to claim the group's ownership", kimpayId, e);
        }
    }

    try {
        await archiveStore.mergeIntoAccount();
    } catch (e) {
        console.error("Failed to merge the archived groups", e);
    }

    // The account's groups, with the identities just linked.
    recentsStore.init(true);
}

async function useIdentity(kimpayId: string, participantId: string) {
    const active = activeKimpayGlobal.instance;
    if (active?.id === kimpayId) await active.setMyParticipant(participantId);
    else await storageService.setMyParticipantId(kimpayId, participantId);
}

/**
 * Logs out and reloads the app on the home page. With `forgetDevice`, the
 * account's groups are removed from this device first (a borrowed one): they
 * come back on the next login. The groups opened here without the account
 * stay.
 */
export async function logout({ forgetDevice = false } = {}) {
    const user = auth.user;
    const removed = forgetDevice && user ? await accountKimpayIds(user.id) : [];
    for (const id of removed) await recentsStore.forget(id);
    archiveStore.keepOnDevice(removed);
    if (forgetDevice) prefs.set(STORAGE_KEYS.HAD_ACCOUNT, null);

    auth.logout();
    window.location.href = "/";
}

/** The groups on this device where the account is someone. */
async function accountKimpayIds(userId: string): Promise<string[]> {
    const ids = new Set<string>();
    try {
        const linked = await pb.collection('participants').getFullList<Participant>({
            filter: pb.filter('user = {:userId}', { userId }),
            fields: 'kimpay',
            requestKey: null,
        });
        for (const p of linked) ids.add(p.kimpay);
    } catch (e) {
        // Offline: the copies on this device tell.
        console.warn("Could not fetch the account's groups", e);
    }

    const local = await storageService.getRecentKimpayIds();
    for (const id of local) {
        const cached = await storageService.getKimpayData(id);
        const me = cached?.expand?.participants_via_kimpay?.find((p) => p.id === cached.myParticipantId);
        if (me?.user === userId) ids.add(id);
    }
    return local.filter((id) => ids.has(id));
}
