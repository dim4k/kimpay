import { pb } from "$lib/pocketbase";
import { EXPAND } from "$lib/constants";
import type { Participant } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte"; // Needed to update parent expand/cache? Or decouple?
import { auth } from "./auth.svelte";
// Decoupling is better: ParticipantStore shouldn't know about KimpayStore struct, but it might need to verify "My Identity"

class ParticipantsStore {
    list = $state<Participant[]>([]);
    myParticipantId = $state<string | null>(null);
    currentKimpayId = $state<string | null>(null);
    isInitialized = $state(false);

    async init(kimpayId: string, initialList: Participant[] = [], skipFetch = false) {
        if (this.currentKimpayId === kimpayId && this.isInitialized) {
            // Already initialized for this kimpay
            return;
        }

        // If switching kimpays, specific logic to avoid stale data
        if (this.currentKimpayId !== kimpayId) {
             this.currentKimpayId = kimpayId;
             this.list = initialList; // Will be empty if not provided, avoiding stale data
        } else {
             // Same kimpay, only update if specific list provided
             if (initialList.length > 0) {
                 this.list = initialList;
             }
        }
        
        this.setMyIdentity(kimpayId);

        if (this.list.length === 0) {
             const cached = storageService.getKimpayData(kimpayId);
             if (cached?.expand?.participants_via_kimpay) {
                 this.list = cached.expand.participants_via_kimpay;
             }
        }
        
        this.isInitialized = true;

        if (skipFetch) {
            this.subscribe(kimpayId);
            return;
        }

        await offlineService.withOfflineSupport(
            async () => {
                 // Try to use getOne on Kimpay to avoid list restriction if possible, 
                 // otherwise fall back to list logic (which might fail if not allowed)
                 // But since we are here, skipFetch is false, so we are probably in a context where we *need* data.
                 // Ideally layout.ts provided it.
                 try {
                     const kimpay = await pb.collection("kimpays").getOne(kimpayId, {
                         expand: EXPAND.KIMPAY_WITH_PARTICIPANTS,
                         requestKey: null
                     });
                     if (kimpay.expand?.participants_via_kimpay) {
                         this.list = kimpay.expand.participants_via_kimpay as unknown as Participant[];
                     }
                 } catch {
                     // Ignore fetch errors
                     // Fallback to list if getOne failed (unlikely if we have access)
                     const records = await pb.collection("participants").getFullList({
                         filter: `kimpay = "${kimpayId}"`,
                         requestKey: null
                     });
                     this.list = records as unknown as Participant[];
                 }
            },
            () => { /* Keep cache */ }
        );

        await this.subscribe(kimpayId);
    }
    
    // Helper to find "Me"
    setMyIdentity(kimpayId: string) {
        // 1. Try Local Storage first (fastest)
        let foundId = storageService.getMyParticipantId(kimpayId);

        // 2. If not found in storage, but we are logged in, check if we are in the list
        if (!foundId && auth.user && this.list.length > 0) {
            const match = this.list.find(p => p.user === auth.user!.id);
            if (match) {
                foundId = match.id;
                // Save to storage for next time
                storageService.setMyParticipantId(kimpayId, foundId);
            }
        }
        
        this.myParticipantId = foundId;
    }
    
    get me() {
        // If we have an explicit ID, use it
        if (this.myParticipantId) {
             return this.list.find(p => p.id === this.myParticipantId) || null;
        }
        
        // Fallback: If logged in, find myself in the list dynamically
        // (This handles cases where list is loaded AFTER setMyIdentity was called)
        if (auth.user) {
            return this.list.find(p => p.user === auth.user!.id) || null;
        }

        return null;
    }

    async subscribe(kimpayId: string) {
        // Unsubscribe from previous (if any) to prevent duplication
        await pb.collection("participants").unsubscribe("*");

        await pb.collection("participants").subscribe("*", (e) => {
            if (e.record.kimpay === kimpayId) {
                const p = e.record as unknown as Participant;
                 if (e.action === "create") {
                     // Check dedupe
                     if (!this.list.find(x => x.id === p.id)) {
                         this.list = [...this.list, p];
                     }
                 } else if (e.action === "update") {
                     this.list = this.list.map(x => x.id === p.id ? p : x);
                 } else if (e.action === "delete") {
                     this.list = this.list.filter(x => x.id !== p.id);
                 }
            }
        });
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
                // Replace optimistic with real
                this.list = this.list.map(p => p.id === tempId ? (record as unknown as Participant) : p);
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
         
         this.list = this.list.map(p => p.id === id ? (updated as unknown as Participant) : p);

        await offlineService.withOfflineSupport(
            async () => {
                const record = await pb.collection('participants').update(id, data);
                 // Update with real record
                this.list = this.list.map(p => p.id === id ? (record as unknown as Participant) : p);
                return record;
            },
            () => {
                if (data.name) {
                    offlineService.queueAction('UPDATE_PARTICIPANT', { id, name: data.name }, optimistic.kimpay);
                }
                return updated as unknown as Participant;
            }
        );
    }
}

export const participantsStore = new ParticipantsStore();
