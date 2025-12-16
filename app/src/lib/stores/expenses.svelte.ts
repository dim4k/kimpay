import { pb } from "$lib/pocketbase";
import type { Expense, Participant } from "$lib/types";
import { asExpense, asExpenses } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte";
import { generatePocketBaseId } from "$lib/utils";
import { REIMBURSEMENT_EMOJI, EXPAND } from "$lib/constants";
import { 
    initListFromCache, 
    createSubscriptionHandler, 
    subscribeToCollection 
} from "./baseStore";


class ExpensesStore {
    list = $state<Expense[]>([]);
    currentKimpayId = $state<string | null>(null);
    isInitialized = $state(false);

    async init(kimpayId: string, initialList: Expense[] = [], skipFetch = false) {
        // console.log(`[ExpensesStore] Init ${kimpayId}. Current: ${this.currentKimpayId}. IsInit: ${this.isInitialized}. SkipFetch: ${skipFetch}`);
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
                return cached?.expand?.expenses_via_kimpay;
            }
        );

        if (shouldSwitch) {
            this.currentKimpayId = kimpayId;
        }

        // Defensive: Filter list to ensure no cross-contamination
        const filteredList = list.filter(e => e.kimpay === kimpayId);
        if (filteredList.length !== list.length) {
            console.error(`[ExpensesStore] CRITICAL: Dropped ${list.length - filteredList.length} expenses with wrong Kimpay ID!`);
        }
        
        this.list = this.sort(filteredList);
        this.isInitialized = true;

        if (skipFetch) {
            this.subscribe(kimpayId);
            return;
        }

        await offlineService.withOfflineSupport(
            async () => {
                try {
                    const kimpay = await pb.collection("kimpays").getOne(kimpayId, {
                        expand: EXPAND.KIMPAY_WITH_EXPENSES,
                        requestKey: null
                    });
                    if (kimpay.expand?.expenses_via_kimpay) {
                        this.list = this.sort(asExpenses(kimpay.expand.expenses_via_kimpay));
                    }
                } catch {
                    const records = await pb.collection("expenses").getFullList({
                        filter: `kimpay = "${kimpayId}"`,
                        expand: EXPAND.EXPENSE_RELATIONS,
                        requestKey: null
                    });
                    this.list = this.sort(asExpenses(records));
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
        const handler = createSubscriptionHandler<Expense>(kimpayId, {
            convertRecord: asExpense,
            getList: () => this.list,
            setList: (items) => { this.list = items; },
            sortItems: (items) => this.sort(items),
            fetchExpanded: async (id) => {
                const record = await pb.collection("expenses").getOne(id, {
                    expand: EXPAND.EXPENSE_RELATIONS,
                    requestKey: null
                });
                return asExpense(record);
            }
        });

        await subscribeToCollection("expenses", handler);
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
                formData.append('id', expenseId);
                const record = await pb.collection('expenses').create(formData, {
                    expand: "payer,involved"
                });
                
                // Swap the optimistic item with the real record (and its real ID)
                this.list = this.sort(this.list.map(e => e.id === expenseId ? asExpense(record) : e));
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
        // Optimistic removal
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
                 this.list = this.sort(asExpenses(kimpay.expand.expenses_via_kimpay));
             }
         } catch(e) {
             console.error("Refresh failed", e);
         }
    }
}

export const expensesStore = new ExpensesStore();
