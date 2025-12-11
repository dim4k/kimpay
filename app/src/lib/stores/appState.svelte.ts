import { pb } from "$lib/pocketbase";
import type { Kimpay, Participant, Expense } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte";
import { recentsService } from "$lib/services/recents.svelte";
import { REIMBURSEMENT_EMOJI } from "$lib/constants";
import { generatePocketBaseId } from "$lib/utils";

class AppState {
    kimpay = $state<Kimpay | null>(null);
    participant = $state<Participant | null>(null);
    expenses = $state<Expense[]>([]);
    participants = $state<Participant[]>([]);

    private subscribedKimpayId: string | null = null;
    private initPromise: Promise<void> | null = null;
    
    constructor() {
        offlineService.registerListener(() => {
            if (this.kimpay) {
                this.subscribe(this.kimpay.id);
            }
        });
    }

    async init(
        kimpayId: string,
        force = false,
        initialData: Kimpay | null = null
    ) {
        if (
            !force &&
            this.kimpay?.id === kimpayId &&
            this.participants.length > 0
        ) {
             if (offlineService.isOffline) return;
        }

        // 0. Load from Local Storage First (Instant Load)
        if (!this.kimpay || this.kimpay.id !== kimpayId) {
            const cached = storageService.getKimpayData(kimpayId);
            if (cached) {
                this.kimpay = cached;
                this.participants = cached.expand?.participants_via_kimpay || [];
                const ex = cached.expand?.expenses_via_kimpay || [];
                this.expenses = this.sortExpenses(ex);
                
                this.identifyUser(kimpayId);
            }
        }

        // Prevent concurrent fetches
        if (this.initPromise) {
            if (this.kimpay?.id === kimpayId && !force) return;
            await this.initPromise;
            if (!force && this.kimpay?.id === kimpayId) return;
        }

        this.initPromise = (async () => {
            try {
                // 1. Fetch Kimpay
                if (initialData) {
                    this.kimpay = initialData;
                } else if (!offlineService.isOffline) {
                    const record = await pb
                        .collection("kimpays")
                        .getOne(kimpayId, {
                            expand: "participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved",
                            requestKey: null,
                        });
                    this.kimpay = record as unknown as Kimpay;
                    
                    storageService.saveKimpayData(kimpayId, this.kimpay);
                }

                if (!this.kimpay) return;

                this.participants =
                    this.kimpay?.expand?.participants_via_kimpay || [];

                const ex = this.kimpay?.expand?.expenses_via_kimpay || [];
                this.expenses = this.sortExpenses(ex);

                // 2. Identify User
                this.identifyUser(kimpayId);

                // 4. Subscribe to Realtime Updates
                if (!offlineService.isOffline) {
                    this.subscribe(kimpayId);
                    offlineService.processPendingQueue();
                }

                recentsService.addRecentKimpay({
                    id: this.kimpay.id,
                    name: this.kimpay.name,
                    created_by: this.kimpay.created_by,
                    icon: this.kimpay.icon || "",
                });
            } catch (e: unknown) {
                console.error("Error initializing app state", e);
                if ((e as { status?: number })?.status === 0) {
                    offlineService.setOffline(true);
                }
            }
        })();

        if (this.kimpay?.id === kimpayId) {
            this.initPromise.finally(() => { this.initPromise = null });
            return;
        }

        try {
            await this.initPromise;
        } finally {
            this.initPromise = null;
        }
    }

    unsubscribe() {
        if (!this.subscribedKimpayId) return;

        pb.collection("kimpays").unsubscribe("*");
        pb.collection("participants").unsubscribe("*");
        pb.collection("expenses").unsubscribe("*");

        this.subscribedKimpayId = null;
    }

    subscribe(kimpayId: string) {
        if (this.subscribedKimpayId === kimpayId) return;

        this.unsubscribe();
        this.subscribedKimpayId = kimpayId;

        // 1. Kimpay details
        pb.collection("kimpays").subscribe(kimpayId, (e) => {
            if (this.kimpay && e.action === "update") {
                this.kimpay = { ...this.kimpay, ...e.record } as Kimpay;
                this.refreshExpenses();
            } else if (e.action === "delete") {
                this.kimpay = null;
            }
        });

        // 2. Participants
        pb.collection("participants").subscribe("*", async (e) => {
            if (e.record.kimpay === kimpayId) {
                const res = await pb.collection("kimpays").getOne(kimpayId, {
                    expand: "participants_via_kimpay",
                    requestKey: null,
                });
                const updatedKimpay = res as unknown as Kimpay;
                this.participants =
                    updatedKimpay.expand?.participants_via_kimpay || [];
                
                if (this.kimpay) {
                     this.kimpay.expand = {
                         ...this.kimpay.expand,
                         participants_via_kimpay: this.participants
                     };
                     storageService.saveKimpayData(this.kimpay.id, this.kimpay);
                }
            }
        });

        // 3. Expenses
        pb.collection("expenses").subscribe("*", async (e) => {
            if (e.record.kimpay === kimpayId) {
                await this.refreshExpenses();
            }
        });
    }

    private identifyUser(kimpayId: string) {
        const participantId = storageService.getMyParticipantId(kimpayId);

        if (participantId) {
            this.participant =
                this.participants.find(
                    (p) => p.id === participantId
                ) || null;
        }
    }

    private sortExpenses(ex: Expense[]) {
         return ex.sort((a, b) => {
            const dateDiff =
                new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return (
                new Date(b.created).getTime() -
                new Date(a.created).getTime()
            );
        });
    }

    async refreshExpenses() {
        if (!this.kimpay || offlineService.isOffline) return;

        const k = await pb.collection("kimpays").getOne(this.kimpay.id, {
            expand: "expenses_via_kimpay.payer,expenses_via_kimpay.involved",
            requestKey: null,
        });
        const kimpayRecord = k as unknown as Kimpay;
        const ex = kimpayRecord.expand?.expenses_via_kimpay || [];
        this.expenses = this.sortExpenses(ex);
        storageService.saveKimpayData(this.kimpay.id, kimpayRecord);
    }

    reset() {
        this.unsubscribe();
        this.kimpay = null;
        this.participant = null;
        this.expenses = [];
        this.participants = [];
    }

    // --- MUTATIONS ---

    async createExpense(formData: FormData) {
        const kimpayId = formData.get('kimpay') as string;
        if (!kimpayId) throw new Error("Kimpay ID missing");

        if (!offlineService.isOffline) {
            try {
                await pb.collection('expenses').create(formData);
                await pb.collection('kimpays').update(kimpayId, { updated: new Date() });
                return;
            } catch (e: unknown) {
                if ((e as { status?: number })?.status === 0) {
                    offlineService.setOffline(true);
                } else {
                    throw e;
                }
            }
        }

        const expenseId = generatePocketBaseId();
        const payerId = formData.get('payer') as string;
        const involvedIds = formData.getAll('involved') as string[];
        
        const payerParticipant = this.participants.find(p => p.id === payerId);
        const expandData: { payer?: Participant, involved?: Participant[] } = {
            involved: this.participants.filter(p => involvedIds.includes(p.id))
        };
        if (payerParticipant) {
            expandData.payer = payerParticipant;
        }

        const optimisticExpense: Expense = {
            id: expenseId,
            collectionId: 'expenses',
            collectionName: 'expenses',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            amount: parseFloat(formData.get('amount') as string),
            description: formData.get('description') as string,
            date: formData.get('date') as string,
            payer: payerId,
            involved: involvedIds,
            kimpay: kimpayId,
            created_by: payerId,
            is_reimbursement: false,
            icon: formData.get('icon') as string,
            expand: expandData
        };

        this.expenses = this.sortExpenses([...this.expenses, optimisticExpense]);
        
        const payload: Record<string, unknown> = {};
        formData.forEach((value, key) => {
             if (key === 'involved') {
                 if (!payload[key]) payload[key] = [];
                 (payload[key] as string[]).push(value as string);
             } else {
                 payload[key] = value;
             }
        });

        offlineService.queueAction('CREATE_EXPENSE', payload, kimpayId, expenseId);
    }

    async deleteExpense(id: string) {
        if (!this.kimpay) return;
        
        const originalExpenses = [...this.expenses];
        this.expenses = this.expenses.filter(e => e.id !== id);

        if (!offlineService.isOffline) {
            try {
                await pb.collection("expenses").delete(id);
                await pb.collection("kimpays").update(this.kimpay.id, { updated: new Date() });
                return;
            } catch (e) {
                if ((e as { status?: number })?.status === 0) {
                    offlineService.setOffline(true);
                } else {
                    this.expenses = originalExpenses;
                    throw e;
                }
            }
        }

        offlineService.queueAction('DELETE_EXPENSE', { id }, this.kimpay.id);
    }

    async createReimbursement(fromId: string, toId: string, amount: number, description: string = "Reimbursement") {
         if (!this.kimpay) return;
         
         const kimpayId = this.kimpay.id;
         const formData = new FormData();
         formData.append('kimpay', kimpayId);
         formData.append('description', description);
         formData.append('amount', amount.toString());
         formData.append('date', new Date().toISOString().split('T')[0] as string);
         formData.append('payer', fromId);
         formData.append('involved', toId);
         formData.append('created_by', fromId);
         if (REIMBURSEMENT_EMOJI) formData.append('icon', REIMBURSEMENT_EMOJI as string);

         // Flag for backend logic vs simple bool
         await this.createExpenseWithFlag(formData, true);
    }
    
    private async createExpenseWithFlag(formData: FormData, isReimbursement = false) {
          const kimpayId = formData.get('kimpay') as string;
        if (!kimpayId) throw new Error("Kimpay ID missing");

        if (!offlineService.isOffline) {
            try {
                 if (isReimbursement) {
                     formData.append('is_reimbursement', 'true');
                 }
                await pb.collection('expenses').create(formData);
                await pb.collection('kimpays').update(kimpayId, { updated: new Date() });
                return;
            } catch (e: unknown) {
                if ((e as { status?: number })?.status === 0) {
                    offlineService.setOffline(true);
                } else {
                    throw e;
                }
            }
        }

        const expenseId = generatePocketBaseId();
        const payerId = formData.get('payer') as string;
        const involvedIds = formData.getAll('involved') as string[];
        
        const payerParticipant = this.participants.find(p => p.id === payerId);
        const expandData: { payer?: Participant, involved?: Participant[] } = {
            involved: this.participants.filter(p => involvedIds.includes(p.id))
        };
        if (payerParticipant) {
            expandData.payer = payerParticipant;
        }

        const optimisticExpense: Expense = {
            id: expenseId,
            collectionId: 'expenses',
            collectionName: 'expenses',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            amount: parseFloat(formData.get('amount') as string),
            description: formData.get('description') as string,
            date: formData.get('date') as string,
            payer: payerId,
            involved: involvedIds,
            kimpay: kimpayId,
            created_by: payerId,
            is_reimbursement: isReimbursement,
            icon: formData.get('icon') as string,
            expand: expandData
        };

        this.expenses = this.sortExpenses([...this.expenses, optimisticExpense]);
        
        const payload: Record<string, unknown> = {};
        formData.forEach((value, key) => {
             if (key === 'involved') {
                 if (!payload[key]) payload[key] = [];
                 (payload[key] as string[]).push(value as string);
             } else {
                 payload[key] = value;
             }
        });
        if (isReimbursement) payload['is_reimbursement'] = true;

        offlineService.queueAction('CREATE_EXPENSE', payload, kimpayId, expenseId);
    }

    async updateParticipant(id: string, data: { name?: string, avatar?: File | null }): Promise<Participant> {
        if (!offlineService.isOffline) {
             try {
                 const record = await pb.collection('participants').update(id, data);
                 // Update local state if it matches current
                 this.participants = this.participants.map(p => p.id === id ? { ...p, ...record } as unknown as Participant : p);
                 if (this.kimpay) {
                     this.kimpay.expand = { ...this.kimpay.expand, participants_via_kimpay: this.participants };
                     storageService.saveKimpayData(this.kimpay.id, this.kimpay);
                 }
                 return record as unknown as Participant;
             } catch (e: unknown) {
                  if ((e as { status?: number })?.status === 0) {
                      offlineService.setOffline(true);
                  } else {
                      throw e;
                  }
             }
        }
        
        // Offline: Queue or fail? Avatar upload offline is tricky.
        // For now, allow name update, reject avatar if offline? 
        // Or just queue it (FormData needed for file).
        
        // If avatar is present, we might skip offline support for now or implement robust queue.
        // Given complexity, let's throw if offline and avatar is present, or just queue name updates.
        
        if (data.avatar) {
            throw new Error("Cannot update avatar while offline");
        }

        const optimistic = this.participants.find(p => p.id === id);
        if (optimistic && data.name) {
             const updated = { ...optimistic, name: data.name, updated: new Date().toISOString() };
             this.participants = this.participants.map(p => p.id === id ? updated : p);
             if (this.kimpay) {
                 this.kimpay.expand = { ...this.kimpay.expand, participants_via_kimpay: this.participants };
                 storageService.saveKimpayData(this.kimpay.id, this.kimpay);
             }
             offlineService.queueAction('UPDATE_PARTICIPANT', { id, name: data.name }, this.kimpay?.id || "");
             return updated;
        }
        
        throw new Error("Offline update failed");
    }

    async createParticipant(kimpayId: string, name: string): Promise<Participant> {
        if (!offlineService.isOffline) {
            try {
                const record = await pb.collection('participants').create({
                    name,
                    kimpay: kimpayId
                });
                return record as unknown as Participant;
            } catch (e: unknown) {
                 if ((e as { status?: number })?.status === 0) {
                     offlineService.setOffline(true);
                 } else {
                     throw e;
                 }
            }
        }

        const tempId = `temp_p_${Date.now()}`;
        const optimisticParticipant: Participant = {
            id: tempId,
            collectionId: 'participants',
            collectionName: 'participants',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            name,
            kimpay: kimpayId
        };
        
        this.participants = [...this.participants, optimisticParticipant];
        if (this.kimpay) {
            this.kimpay.expand = {
                ...this.kimpay.expand,
                participants_via_kimpay: this.participants
            };
            storageService.saveKimpayData(kimpayId, this.kimpay);
        }
        
        offlineService.queueAction('CREATE_PARTICIPANT', { name, kimpay: kimpayId }, kimpayId, tempId);
        
        return optimisticParticipant;
    }

    async updateKimpay(name: string, icon?: string): Promise<Kimpay> {
        if (!this.kimpay) throw new Error("No Kimpay selected");
        
        const updates: { name: string, icon?: string, updated: Date } = { 
            name, 
            updated: new Date() 
        };
        if (icon !== undefined) updates.icon = icon;

        if (!offlineService.isOffline) {
            try {
                const record = await pb.collection('kimpays').update(this.kimpay.id, updates);
                const updated = record as unknown as Kimpay;
                this.kimpay = { ...this.kimpay, ...updated };
                storageService.saveKimpayData(this.kimpay.id, this.kimpay);
                // Recents update handled by subscription or manually if needed
                 recentsService.updateRecentKimpay({
                    id: this.kimpay.id,
                    name: this.kimpay.name,
                    icon: this.kimpay.icon || "",
                    created_by: this.kimpay.created_by
                });
                return updated;
            } catch (e: unknown) {
                if ((e as { status?: number })?.status === 0) {
                    offlineService.setOffline(true);
                } else {
                    throw e;
                }
            }
        }

        // Optimistic Update
        const optimistic = { ...this.kimpay, ...updates, updated: new Date().toISOString() };
        this.kimpay = optimistic as Kimpay;
        storageService.saveKimpayData(this.kimpay.id, this.kimpay);
        
        recentsService.updateRecentKimpay({
            id: this.kimpay.id,
            name: this.kimpay.name,
            icon: this.kimpay.icon || "",
            created_by: this.kimpay.created_by
        });

        offlineService.queueAction('UPDATE_KIMPAY', { name, icon }, this.kimpay.id);
        return optimistic as Kimpay;
    }

    async deleteKimpay(id: string) {
         if (!offlineService.isOffline) {
            try {
                await pb.collection('kimpays').delete(id);
                return;
            } catch (e: unknown) {
                 if ((e as { status?: number })?.status === 0) {
                    offlineService.setOffline(true);
                } else {
                    throw e;
                }
            }
        }
        
        // If offline, we can't really "delete" it from server yet, 
        // but we can queue it and remove locally.
        // However, for severe actions like Delete Group, maybe restrict to Online only?
        // User requirement: "All actions ... fully support offline mode". 
        // So we should support it.
        
        offlineService.queueAction('DELETE_KIMPAY', {}, id);
    }


}

export const appState = new AppState();
