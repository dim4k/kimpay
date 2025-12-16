import { pb } from "$lib/pocketbase";
import type { Kimpay } from "$lib/types";
import { asKimpay } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte";
import { recentsService } from "$lib/services/recents.svelte";
import { generatePocketBaseId, generateUUID } from "$lib/utils";

class KimpayStore {
    data = $state<Kimpay | null>(null);

    async init(kimpayId: string, initialData?: Kimpay, skipFetch = false) {
        if (this.data?.id === kimpayId && !initialData) return;

        // 1. Load from cache
        if (!initialData) {
            const cached = storageService.getKimpayData(kimpayId);
            if (cached) {
                this.data = cached;
            } else if (this.data?.id !== kimpayId) {
                // If switching and no cache, clear old data to avoid stale UI
                this.data = null;
            }
        } else {
            this.data = initialData;
        }

        if (skipFetch) {
            this.subscribe(kimpayId);
            return;
        }

        // 2. Refresh from server (with offline support)
        await offlineService.withOfflineSupport(
            async () => {
                const record = await pb.collection("kimpays").getOne(kimpayId, {
                    requestKey: null
                });
                this.update(asKimpay(record));
            },
            () => { /* Stay with cached data */ }
        );

        await this.subscribe(kimpayId);
    }

    private update(newData: Kimpay) {
        this.data = { ...this.data, ...newData } as Kimpay;
        storageService.saveKimpayData(this.data.id, this.data);
        
        recentsService.updateRecentKimpay({
            id: this.data.id,
            name: this.data.name,
            icon: this.data.icon || "",
            created_by: this.data.created_by
        });
    }

    async subscribe(kimpayId: string) {
        // Unsubscribe from everything to be safe
        await pb.collection("kimpays").unsubscribe();

        await pb.collection("kimpays").subscribe(kimpayId, (e) => {
            if (e.action === "update") {
                this.update(asKimpay(e.record));
            } else if (e.action === "delete") {
                this.data = null;
            }
        });
    }

    unsubscribe() {
        if (this.data) {
             pb.collection("kimpays").unsubscribe(this.data.id);
        }
    }

    async updateDetails(name: string, icon?: string) {
        if (!this.data) throw new Error("No Kimpay selected");
        
        const updates: { name: string, icon?: string, updated: Date } = { 
            name, 
            updated: new Date() 
        };
        if (icon !== undefined) updates.icon = icon;

        // Optimistic update

        const optimistic = { ...this.data, ...updates, updated: new Date().toISOString() };
        this.update(optimistic as Kimpay);

        await offlineService.withOfflineSupport(
            async () => {
                const record = await pb.collection('kimpays').update(this.data!.id, updates);
                this.update(asKimpay(record));
            },
            () => {
                offlineService.queueAction('UPDATE_KIMPAY', { name, icon }, this.data!.id);
            }
        );
    }

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
                await pb.collection('kimpays').create({
                    id: kimpayId,
                    name,
                    icon,
                    invite_token: inviteToken,
                });

                // 2. Create Creator
                await pb.collection('participants').create({
                    id: creatorId,
                    name: creatorName,
                    kimpay: kimpayId,
                    user: creatorUserId
                });

                // 3. Update Kimpay created_by
                await pb.collection('kimpays').update(kimpayId, { created_by: creatorId });

                // 4. Other Participants
                 if (otherParticipants.length > 0) {
                     await Promise.all(otherParticipants.map(pName => 
                         pb.collection('participants').create({
                             name: pName,
                             kimpay: kimpayId
                         }, { requestKey: null })
                     ));
                 }
                 
                 return { id: kimpayId, creatorId };
            },
            () => {
                offlineService.queueAction('CREATE_KIMPAY', { 
                    id: kimpayId, name, icon, invite_token: inviteToken 
                }, kimpayId, kimpayId);
                
                offlineService.queueAction('CREATE_PARTICIPANT', {
                    id: creatorId, name: creatorName, kimpay: kimpayId, user: creatorUserId
                }, kimpayId, creatorId);

                otherParticipants.forEach(pName => {
                     offlineService.queueAction('CREATE_PARTICIPANT', { name: pName, kimpay: kimpayId }, kimpayId);
                });
                
                offlineService.queueAction('UPDATE_KIMPAY', { created_by: creatorId }, kimpayId);
                
                return { id: kimpayId, creatorId };
            }
        );

        return { id: kimpayId, creatorId };
    }


    async delete(kimpayId: string) {
        if (this.data && this.data.id === kimpayId) {
             // Cleanup local
             this.data = null;
        }

        await offlineService.withOfflineSupport(
            async () => {
                await pb.collection('kimpays').delete(kimpayId);
            },
            () => {
                offlineService.queueAction('DELETE_KIMPAY', {}, kimpayId, kimpayId);
            }
        ).catch(e => {
             console.error("Delete failed", e);
             throw e;
        });
    }
}

export const kimpayStore = new KimpayStore();
