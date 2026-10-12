import { pb } from "#lib/pocketbase.js";
import { STORAGE_KEYS } from "#lib/constants.js";
import { auth } from "#lib/stores/auth.svelte.js";
import { activeKimpayGlobal } from "#lib/stores/activeKimpayGlobal.svelte.js";
import { storageService } from "#lib/services/storage.js";
import { userService } from "#lib/services/user.js";
import type { Participant } from "#lib/types.js";

export interface PaymentHandles {
    paypal: string;
    revolut: string;
}

const NONE: PaymentHandles = { paypal: "", revolut: "" };

export function hasHandles(handles: Partial<PaymentHandles> | null | undefined): boolean {
    return !!(handles?.paypal || handles?.revolut);
}

function readLocal(): PaymentHandles {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENT_HANDLES) ?? "null");
        return { paypal: saved?.paypal ?? "", revolut: saved?.revolut ?? "" };
    } catch {
        return NONE;
    }
}

function writeLocal(handles: PaymentHandles) {
    try {
        if (hasHandles(handles)) localStorage.setItem(STORAGE_KEYS.PAYMENT_HANDLES, JSON.stringify(handles));
        else localStorage.removeItem(STORAGE_KEYS.PAYMENT_HANDLES);
    } catch {
        // Storage unavailable (private mode...): kept for this session only.
    }
}

/**
 * What follows me in all my groups. The payment handles are entered once
 * here: on the account when logged in, on this device otherwise. They are
 * private until shown in a group, which copies them onto my participant
 * there (the record the other members read).
 */
class ProfileStore {
    private local = $state<PaymentHandles>(typeof localStorage === "undefined" ? NONE : readLocal());

    /** The account's handles, or this device's (a guest, or an account without any yet). */
    handles = $derived<PaymentHandles>(
        hasHandles(auth.user) ? { paypal: auth.user!.paypal ?? "", revolut: auth.user!.revolut ?? "" } : this.local,
    );

    hasHandles = $derived(hasHandles(this.handles));

    /** Save the handles and update the groups where they are shown. */
    async saveHandles(handles: PaymentHandles, { propagate = true } = {}) {
        if (auth.user) {
            auth.setUser(await userService.updatePaymentHandles(auth.user.id, handles));
            // The account holds them now: no stale device copy to fall back on.
            this.local = NONE;
            writeLocal(NONE);
        } else {
            this.local = handles;
            writeLocal(handles);
        }
        if (propagate) await this.updateShownGroups(handles);
    }

    /**
     * Handles entered in a group before the profile had any (they used to be
     * per group): take them into the profile.
     */
    async adopt(participant: Pick<Participant, "paypal" | "revolut"> | undefined) {
        if (this.hasHandles || !hasHandles(participant)) return;
        await this.saveHandles(
            { paypal: participant!.paypal ?? "", revolut: participant!.revolut ?? "" },
            { propagate: false },
        );
    }

    /** Show (or hide) my handles in the active group. */
    async showInActiveGroup(show: boolean) {
        await activeKimpayGlobal.instance?.updateMyPaymentHandles(show ? this.handles : NONE);
    }

    /** Groups on this device where my participant shows handles get the new ones. */
    private async updateShownGroups(handles: PaymentHandles) {
        const ids = await storageService.getRecentKimpayIds();
        await Promise.all(
            ids.map(async (id) => {
                try {
                    const active = activeKimpayGlobal.instance?.id === id ? activeKimpayGlobal.instance : null;
                    const data = active ? null : await storageService.getKimpayData(id);
                    const myId = active ? active.myParticipantId : data?.myParticipantId;
                    const participants = active ? active.participants : data?.expand?.participants_via_kimpay;
                    const me = participants?.find((p) => p.id === myId);
                    if (!myId || !hasHandles(me)) return;
                    if (active) await active.updateMyPaymentHandles(handles);
                    else await pb.collection("participants").update(myId, handles);
                } catch (e) {
                    console.warn("Could not update payment handles in", id, e);
                }
            }),
        );
    }
}

export const profileStore = new ProfileStore();
