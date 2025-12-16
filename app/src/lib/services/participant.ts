import { pb } from '$lib/pocketbase';
import type { Participant } from '$lib/types';

export const participantService = {
    /**
     * Claims a participant profile for a user, ensuring they are not double-linked 
     * in the same Kimpay group. It unclaims any *other* participant linked to this user
     * in the same group before claiming the target one.
     */
    async claim(participantId: string, kimpayId: string, userId: string): Promise<Participant> {
        // 1. Fetch Kimpay with participants (Allowed via getOne if we have access)
        const kimpay = await pb.collection('kimpays').getOne(kimpayId, {
            expand: 'participants_via_kimpay'
        });
        
        const records = (kimpay.expand?.participants_via_kimpay || []) as Participant[];
        const usersParticipants = records.filter(p => p.user === userId);

        // 2. Unclaim others (if any exist that are NOT the target)
        const others = usersParticipants.filter(p => p.id !== participantId);
        if (others.length > 0) {
            await Promise.all(others.map(p => 
                 pb.collection('participants').update(p.id, { user: null }) 
            ));
        }

        // 3. Claim the target participant
        // Check if already claimed
        const alreadyClaimed = usersParticipants.some(p => p.id === participantId);
        if (alreadyClaimed) {
             // If we found it in the filter, return it (fetch fresh to be sure or use cached)
             return records.find(p => p.id === participantId)!;
        }

        return await pb.collection('participants').update<Participant>(participantId, {
            user: userId
        });
    },

    /**
     * Creates a new participant.
     */
    async create(kimpayId: string, name: string, localId?: string, userId?: string, avatar?: File): Promise<Participant> {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('kimpay', kimpayId);
        if (localId) formData.append('local_id', localId);
        if (userId) formData.append('user', userId);
        if (avatar) formData.append('avatar', avatar);

        return await pb.collection('participants').create<Participant>(formData);
    }
};
