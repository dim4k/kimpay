import { pb } from "$lib/pocketbase";
import type { Expense, Participant } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte";
import { generatePocketBaseId } from "$lib/utils";
import { REIMBURSEMENT_EMOJI, EXPAND } from "$lib/constants";


class ExpensesStore {
    list = $state<Expense[]>([]);
    currentKimpayId = $state<string | null>(null);
    isInitialized = $state(false);

    async init(kimpayId: string, initialList: Expense[] = [], skipFetch = false) {
        if (this.currentKimpayId === kimpayId && this.isInitialized) {
             // Already initialized and subscribed for this kimpay
             return;
        }

        // If switching kimpays, specific logic to avoid stale data
        if (this.currentKimpayId !== kimpayId) {
             this.currentKimpayId = kimpayId;
             this.list = this.sort(initialList); // Will be empty if not provided, avoiding stale data
        } else {
             // Same kimpay, only update if specific list provided
             if (initialList.length > 0) {
                 this.list = this.sort(initialList);
             }
        }

        if (this.list.length === 0) {
             const cached = storageService.getKimpayData(kimpayId);
             if (cached?.expand?.expenses_via_kimpay) {
                 this.list = this.sort(cached.expand.expenses_via_kimpay);
             }
        }
        
        this.isInitialized = true;

        if (skipFetch) {
            this.subscribe(kimpayId);
            return;
        }

        await offlineService.withOfflineSupport(
            async () => {
                 // Use expansion strategy
                 try {
                     const kimpay = await pb.collection("kimpays").getOne(kimpayId, {
                         expand: EXPAND.KIMPAY_WITH_EXPENSES,
                         requestKey: null
                     });
                     if (kimpay.expand?.expenses_via_kimpay) {
                         this.list = this.sort(kimpay.expand.expenses_via_kimpay as unknown as Expense[]);
                     }
                 } catch {
                     const records = await pb.collection("expenses").getFullList({
                         filter: `kimpay = "${kimpayId}"`,
                         expand: EXPAND.EXPENSE_RELATIONS,
                         requestKey: null
                     });
                     this.list = this.sort(records as unknown as Expense[]);
                 }
            },
            () => { /* Keep cache */ }
        );

        await this.subscribe(kimpayId);
    }

    private sort(ex: Expense[]) {
         return ex.sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.created).getTime() - new Date(a.created).getTime();
        });
    }

    async subscribe(kimpayId: string) {
        // Unsubscribe from previous (if any) to prevent duplication
        // We await to ensure the SDK has processed the removal before adding a new one
        await pb.collection("expenses").unsubscribe("*");
        
        await pb.collection("expenses").subscribe("*", async (e) => {
            if (e.record.kimpay === kimpayId) {
                if (offlineService.isOffline) return;

                const ex = e.record as unknown as Expense;
                // Fetch single expanded record to ensure we have relations (payer, involved)
                // If getOne isn't allowed for expenses, we are stuck. 
                // But usually getOne is allowed if part of Kimpay? 
                // Actually, if list is forbidden, getOne on expense might be allowed if we are participant.
                try {
                     const expanded = await pb.collection("expenses").getOne(ex.id, {
                         expand: "payer,involved",
                         requestKey: null
                     });
                     
                     if (e.action === "create") {
                         if (!this.list.some(x => x.id === expanded.id)) {
                             this.list = this.sort([...this.list, expanded as unknown as Expense]);
                         }
                     } else if (e.action === "update") {
                         this.list = this.sort(this.list.map(x => x.id === expanded.id ? (expanded as unknown as Expense) : x));
                     }
                } catch (err) {
                    console.error("Failed to fetch expanded expense update", err);
                    // Fallback: Use non-expanded record if desperate, but UI might break.
                }

                if (e.action === "delete") {
                     this.list = this.list.filter(x => x.id !== ex.id);
                }
            }
        });
    }

    async create(formData: FormData, participants: Participant[]) {
        const kimpayId = formData.get('kimpay') as string;
        const payerId = formData.get('payer') as string;
        const involvedIds = formData.getAll('involved') as string[];
        const expenseId = generatePocketBaseId();

        // Optimistic
        const payerParticipant = participants.find(p => p.id === payerId);
        const expandData: { payer?: Participant, involved?: Participant[] } = {
            involved: participants.filter(p => involvedIds.includes(p.id))
        };
        if (payerParticipant) expandData.payer = payerParticipant;

        const optimistic: Expense = {
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
            is_reimbursement: formData.get('is_reimbursement') === 'true',
            icon: formData.get('icon') as string,
            expand: expandData
        };

        this.list = this.sort([...this.list, optimistic]);

        await offlineService.withOfflineSupport(
            async () => {
                const record = await pb.collection('expenses').create(formData, {
                    expand: "payer,involved"
                });
                
                // Swap the optimistic item with the real record (and its real ID)
                this.list = this.sort(this.list.map(e => e.id === expenseId ? (record as unknown as Expense) : e));
            },
            () => {
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
        );
    }

    async createReimbursement(from: string, to: string, amount: number, description: string, kimpayId: string, participants: Participant[]) {
        const formData = new FormData();
        formData.append('kimpay', kimpayId);
        formData.append('amount', amount.toString());
        formData.append('description', description);
        formData.append('date', new Date().toISOString());
        formData.append('payer', from);
        formData.append('involved', to);
        formData.append('created_by', from);
        formData.append('is_reimbursement', 'true');
        formData.append('icon', REIMBURSEMENT_EMOJI); // Ensure imported

        return this.create(formData, participants);
    }
    
    async delete(expenseId: string, kimpayId: string) {
        // Optimistic
        // Optimistic
        this.list = this.list.filter(e => e.id !== expenseId);

        await offlineService.withOfflineSupport(
            async () => {
                await pb.collection('expenses').delete(expenseId);
            },
            () => {
                offlineService.queueAction('DELETE_EXPENSE', {}, kimpayId, expenseId);
            }
        ).catch(() => {
        });
    }

    async refresh(kimpayId: string) {
         if (offlineService.isOffline) return;
         // Refetch via parent to bypass list restriction
         try {
             const kimpay = await pb.collection("kimpays").getOne(kimpayId, {
                 expand: "expenses_via_kimpay.payer,expenses_via_kimpay.involved",
                 requestKey: null
             });
             if (kimpay.expand?.expenses_via_kimpay) {
                 this.list = this.sort(kimpay.expand.expenses_via_kimpay as unknown as Expense[]);
             }
         } catch(e) {
             console.error("Refresh failed", e);
         }
    }
}

export const expensesStore = new ExpensesStore();
