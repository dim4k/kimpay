import { pb } from "$lib/pocketbase";
import { offlineService } from "$lib/services/offline.svelte";
import { generatePocketBaseId, generateUUID } from "$lib/utils";

export const kimpayService = {
    async create(
        name: string,
        icon: string,
        creatorName: string,
        otherParticipants: string[],
        creatorUserId?: string
    ) {
        const kimpayId = generatePocketBaseId();
        const creatorId = generatePocketBaseId();
        const inviteToken = generateUUID();

        await offlineService.withOfflineSupport(
            async () => {
                // 1. Create Kimpay
                await pb.collection("kimpays").create({
                    id: kimpayId,
                    name,
                    icon,
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
                offlineService.queueAction(
                    "CREATE_KIMPAY",
                    {
                        id: kimpayId,
                        name,
                        icon,
                        invite_token: inviteToken,
                    },
                    kimpayId,
                    kimpayId
                );

                offlineService.queueAction(
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
                    offlineService.queueAction(
                        "CREATE_PARTICIPANT",
                        { name: pName, kimpay: kimpayId },
                        kimpayId
                    );
                });

                offlineService.queueAction(
                    "UPDATE_KIMPAY",
                    { created_by: creatorId },
                    kimpayId
                );

                return { id: kimpayId, creatorId };
            }
        );

        return { id: kimpayId, creatorId };
    },
};
