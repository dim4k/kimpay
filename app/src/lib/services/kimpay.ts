import { pb } from "#lib/pocketbase.js";
import { offlineStore, QUEUED } from "#lib/stores/offline.svelte.js";
import { storageService } from "#lib/services/storage.js";
import { generatePocketBaseId, generateUUID } from "#lib/utils/index.js";
import { DEFAULT_CURRENCY } from "#lib/services/currency.js";
import { type Kimpay, type Participant, asKimpay } from "#lib/types.js";

/** Body of POST /api/kimpay/create (see pb_hooks/kimpay.pb.js). */
interface NewKimpay {
    id: string;
    name: string;
    icon: string;
    currency: string;
    invite_token: string;
    /** Creator key: proves later that this device created the group (only its hash is stored) */
    owner_key: string;
    creator: { id: string; name: string };
    participants: { id: string; name: string }[];
}

/**
 * Cache a group created offline as if fetched, so it opens (and takes
 * expenses) before the server knows it.
 */
async function cacheOfflineKimpay(data: NewKimpay) {
    const now = new Date().toISOString();
    const participant = ({ id, name }: { id: string; name: string }): Participant => ({
        id,
        name,
        kimpay: data.id,
        created: now,
        updated: now,
        collectionId: "participants",
        collectionName: "participants",
    });
    const kimpay: Kimpay = {
        id: data.id,
        name: data.name,
        icon: data.icon,
        currency: data.currency,
        invite_token: data.invite_token,
        created_by: data.creator.id,
        created: now,
        updated: now,
        collectionId: "kimpays",
        collectionName: "kimpays",
        myParticipantId: data.creator.id,
        expand: {
            participants_via_kimpay: [data.creator, ...data.participants].map(participant),
            expenses_via_kimpay: [],
        },
    };
    await storageService.saveKimpayData(data.id, kimpay);
}

export const kimpayService = {
    /**
     * A group with all its participants and expenses (in `expand`), unlike a
     * back-relation expand, capped at 1000 records. `fields` picks what is
     * returned (PocketBase `fields` syntax).
     */
    async getWithData(id: string, fields?: string): Promise<Kimpay> {
        const record = await pb.send(`/api/kimpay/${encodeURIComponent(id)}/data`, {
            ...(fields && { query: { fields } }),
            requestKey: null,
        });
        return asKimpay(record);
    },

    /**
     * Create a group with its creator (linked to the logged-in account, if
     * any) and other members, in a single server transaction: never half a
     * group, even if the connection drops. Queued when offline.
     *
     * The device keeps a creator key: logged in later, it makes the account
     * the group's owner (see claimOwnership).
     */
    async create(
        name: string,
        icon: string,
        creatorName: string,
        otherParticipants: string[],
        currency: string = DEFAULT_CURRENCY
    ) {
        const data: NewKimpay = {
            id: generatePocketBaseId(),
            name,
            icon,
            currency,
            invite_token: generateUUID(),
            owner_key: generateUUID(),
            creator: { id: generatePocketBaseId(), name: creatorName },
            participants: otherParticipants.map((pName) => ({
                id: generatePocketBaseId(),
                name: pName,
            })),
        };

        await storageService.setOwnerKey(data.id, data.owner_key);
        const result = await offlineStore.write(
            () =>
                pb.send("/api/kimpay/create", {
                    method: "POST",
                    body: data,
                    requestKey: null,
                }),
            { type: "CREATE_KIMPAY", payload: { ...data }, kimpayId: data.id, id: data.id }
        );
        if (result === QUEUED) await cacheOfflineKimpay(data);

        return { id: data.id, creatorId: data.creator.id };
    },

    /**
     * Make the logged-in account the owner of a group this device created (the
     * one allowed to delete it), with the creator key kept at creation. The
     * key is dropped once used or refused; kept on a network error, or while
     * the server does not know the group yet (created offline).
     */
    async claimOwnership(kimpayId: string): Promise<void> {
        if (!pb.authStore.record) return;
        const key = await storageService.getOwnerKey(kimpayId);
        if (!key) return;
        try {
            await pb.send(`/api/kimpay/${kimpayId}/own`, { method: 'POST', body: { key }, requestKey: null });
        } catch (e) {
            const status = (e as { status?: number }).status;
            if (status !== 403) throw e;
        }
        await storageService.removeOwnerKey(kimpayId);
    },

    /**
     * Merge two participants (the same person, added twice): everything of
     * `from` passes to `into`, then `from` is deleted. Online only.
     */
    async mergeParticipants(kimpayId: string, from: string, into: string): Promise<void> {
        await pb.send(`/api/kimpay/${kimpayId}/merge`, { method: 'POST', body: { from, into } });
    },

    /** New group currency; `rate` (1 old = rate new) converts the expenses, server side. */
    async changeCurrency(kimpayId: string, to: string, rate: number): Promise<void> {
        await pb.send(`/api/kimpay/${kimpayId}/currency`, { method: 'POST', body: { to, rate } });
    },

    /** What a member counts for in new expenses (see members.pb.js). */
    async setMemberDefaults(
        kimpayId: string,
        participantId: string,
        changes: { inactive?: boolean; default_shares?: number },
    ): Promise<void> {
        await pb.send(`/api/kimpay/${kimpayId}/participants/${participantId}/defaults`, { method: 'POST', body: changes });
    },

    /**
     * Leave a Kimpay - handles participant deletion/unclaim logic.
     * Checks if participant is creator or involved in expenses before deciding action.
     * @returns Object with action taken and success status
     */
    async leave(
        kimpayId: string,
        participantId: string
    ): Promise<{ action: 'deleted' | 'unclaimed' | 'none'; success: boolean }> {
        try {
            // Fetch kimpay with expenses to check involvement
            const kimpay = await kimpayService.getWithData(
                kimpayId,
                'created_by,expand.expenses_via_kimpay.payer,expand.expenses_via_kimpay.involved'
            );

            let canDelete = true;

            // 1. Check if participant is the creator
            if (kimpay.created_by === participantId) {
                canDelete = false;
            }

            // 2. Check if participant is involved in any expenses
            if (canDelete) {
                const expenses = kimpay.expand?.expenses_via_kimpay || [];
                const isInvolved = expenses.some(
                    (e: { payer: string; involved?: string[] }) =>
                        e.payer === participantId ||
                        (e.involved && e.involved.includes(participantId))
                );
                if (isInvolved) {
                    canDelete = false;
                }
            }

            // 3. Execute action
            if (canDelete) {
                try {
                    await pb.collection('participants').delete(participantId);
                    return { action: 'deleted', success: true };
                } catch {
                    // Delete failed (constraint), try unclaim
                    await pb.collection('participants').update(participantId, { user: null });
                    return { action: 'unclaimed', success: true };
                }
            } else {
                // Can't delete - unclaim only
                await pb.collection('participants').update(participantId, { user: null });
                return { action: 'unclaimed', success: true };
            }
        } catch (error) {
            console.error('Failed to leave kimpay', error);
            return { action: 'none', success: false };
        }
    },
};
