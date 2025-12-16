import { pb } from "$lib/pocketbase";
import { EXPAND } from "$lib/constants";
import type { Participant } from "$lib/types";
import { asParticipant, asParticipants } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte";
import { auth } from "./auth.svelte";
import { 
    initListFromCache, 
    createSubscriptionHandler, 
    subscribeToCollection 
} from "./baseStore";

class ParticipantsStore {
    list = $state<Participant[]>([]);
    myParticipantId = $state<string | null>(null);
    currentKimpayId = $state<string | null>(null);
    isInitialized = $state(false);

    async init(kimpayId: string, initialList: Participant[] = [], skipFetch = false) {
        // Always refresh identity from storage to ensure consistency
        this.setMyIdentity(kimpayId);

        if (this.currentKimpayId === kimpayId && this.isInitialized) {
            return;
        }

        // Use shared cache-first initialization logic
        const { list, shouldSwitch } = initListFromCache(
            this.currentKimpayId,
            kimpayId,
            initialList,
            () => {
                const cached = storageService.getKimpayData(kimpayId);
                return cached?.expand?.participants_via_kimpay;
            }
        );

        if (shouldSwitch) {
            this.currentKimpayId = kimpayId;
        }
        this.list = list;
        // Re-run identity check in case list was empty before and now populated?
        // No, setMyIdentity uses 'this.list' to fallback to auth.user matching.
        // So we should run it AFTER list update too if list changed.
        this.setMyIdentity(kimpayId); 
        this.isInitialized = true;

        if (skipFetch) {
            this.subscribe(kimpayId);
            return;
        }

        await offlineService.withOfflineSupport(
            async () => {
                try {
                    const kimpay = await pb.collection("kimpays").getOne(kimpayId, {
                        expand: EXPAND.KIMPAY_WITH_PARTICIPANTS,
                        requestKey: null
                    });
                    if (kimpay.expand?.participants_via_kimpay) {
                        this.list = asParticipants(kimpay.expand.participants_via_kimpay);
                    }
                } catch {
                    const records = await pb.collection("participants").getFullList({
                        filter: `kimpay = "${kimpayId}"`,
                        requestKey: null
                    });
                    this.list = asParticipants(records);
                }
            },
            () => { /* Keep cache */ }
        );

        await this.subscribe(kimpayId);
    }
    
    // Helper to find "Me"
    setMyIdentity(kimpayId: string) {
        let foundId = storageService.getMyParticipantId(kimpayId);

        if (!foundId && auth.user && this.list.length > 0) {
            const match = this.list.find(p => p.user === auth.user!.id);
            if (match) {
                foundId = match.id;
                storageService.setMyParticipantId(kimpayId, foundId);
            }
        }
        
        this.myParticipantId = foundId;
    }
    
    get me() {
        if (this.myParticipantId) {
            return this.list.find(p => p.id === this.myParticipantId) || null;
        }
        
        if (auth.user) {
            return this.list.find(p => p.user === auth.user!.id) || null;
        }

        return null;
    }

    async subscribe(kimpayId: string) {
        const handler = createSubscriptionHandler<Participant>(kimpayId, {
            convertRecord: asParticipant,
            getList: () => this.list,
            setList: (items) => { this.list = items; }
            // No sorting needed for participants
            // No fetchExpanded needed - participants have no complex relations
        });

        await subscribeToCollection("participants", handler);
    }

    async create(kimpayId: string, name: string) {
         const tempId = `temp_p_${Date.now()}`;
         const optimistic: Participant = {
            id: tempId,
            collectionId: 'participants',
            collectionName: 'participants',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            name,
            kimpay: kimpayId
        };

        this.list = [...this.list, optimistic];

        await offlineService.withOfflineSupport(
            async () => {
                const record = await pb.collection('participants').create({ name, kimpay: kimpayId });
                // Replace optimistic with real, but check if subscription already added it
                const realExists = this.list.some(p => p.id === record.id);
                
                if (realExists) {
                     this.list = this.list.filter(p => p.id !== tempId);
                } else {
                     this.list = this.list.map(p => p.id === tempId ? asParticipant(record) : p);
                }
            },
            () => {
                offlineService.queueAction('CREATE_PARTICIPANT', { name, kimpay: kimpayId }, kimpayId, tempId);
            }
        );
    }
    async update(id: string, data: { name?: string, avatar?: File | null }) {
        if (data.avatar) {
            // Cannot update avatar offline easily without complex queue
            if (offlineService.isOffline) throw new Error("Cannot update avatar while offline");
        }

        const optimistic = this.list.find(p => p.id === id);
        if (!optimistic) return;

         const updated = { ...optimistic, ...data, updated: new Date().toISOString() };
         // Remove file object from optimistic state if present, keep string url if possible or nothing
         if (data.avatar) delete (updated as Record<string, unknown>).avatar; 
         
         this.list = this.list.map(p => p.id === id ? asParticipant(updated) : p);

        await offlineService.withOfflineSupport(
            async () => {
                const record = await pb.collection('participants').update(id, data);
                 // Update with real record
                this.list = this.list.map(p => p.id === id ? asParticipant(record) : p);
                return record;
            },
            () => {
                if (data.name) {
                    offlineService.queueAction('UPDATE_PARTICIPANT', { id, name: data.name }, optimistic.kimpay);
                }
                return asParticipant(updated);
            }
        );
    }
}

export const participantsStore = new ParticipantsStore();
