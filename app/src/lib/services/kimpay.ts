import { pb } from "$lib/pocketbase";
import { offlineStore } from "$lib/stores/offline.svelte";
import { generatePocketBaseId, generateUUID } from "$lib/utils";
import { DEFAULT_CURRENCY } from "$lib/services/currency";

export const kimpayService = {
    async create(
        name: string,
        icon: string,
        creatorName: string,
        otherParticipants: string[],
        creatorUserId?: string,
        currency: string = DEFAULT_CURRENCY
    ) {
        const kimpayId = generatePocketBaseId();
        const creatorId = generatePocketBaseId();
        const inviteToken = generateUUID();

        await offlineStore.withOfflineSupport(
            async () => {
                // 1. Create Kimpay
                await pb.collection("kimpays").create({
                    id: kimpayId,
                    name,
                    icon,
                    currency,
                    invite_token: inviteToken,
                });

                // 2. Create Creator
                await pb.collection("participants").create({
                    id: creatorId,
                    name: creatorName,
                    kimpay: kimpayId,
                    user: creatorUserId,
                });

                // 3. Update Kimpay created_by
                await pb
                    .collection("kimpays")
                    .update(kimpayId, { created_by: creatorId });

                // 4. Other Participants
                if (otherParticipants.length > 0) {
                    await Promise.all(
                        otherParticipants.map((pName) =>
                            pb.collection("participants").create(
                                {
                                    name: pName,
                                    kimpay: kimpayId,
                                },
                                { requestKey: null }
                            )
                        )
                    );
                }

                return { id: kimpayId, creatorId };
            },
            () => {
                offlineStore.queueAction(
                    "CREATE_KIMPAY",
                    {
                        id: kimpayId,
                        name,
                        icon,
                        currency,
                        invite_token: inviteToken,
                    },
                    kimpayId,
                    kimpayId
                );

                offlineStore.queueAction(
                    "CREATE_PARTICIPANT",
                    {
                        id: creatorId,
                        name: creatorName,
                        kimpay: kimpayId,
                        user: creatorUserId,
                    },
                    kimpayId,
                    creatorId
                );

                otherParticipants.forEach((pName) => {
                    offlineStore.queueAction(
                        "CREATE_PARTICIPANT",
                        { name: pName, kimpay: kimpayId },
                        kimpayId
                    );
                });

                offlineStore.queueAction(
                    "UPDATE_KIMPAY",
                    { created_by: creatorId },
                    kimpayId
                );

                return { id: kimpayId, creatorId };
            }
        );

        return { id: kimpayId, creatorId };
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
            const kimpay = await pb.collection('kimpays').getOne(kimpayId, {
                expand: 'expenses_via_kimpay'
            });

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
