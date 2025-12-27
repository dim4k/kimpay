import { pb } from "$lib/pocketbase";
import { storageService } from "$lib/services/storage";
import { offlineStore } from "$lib/stores/offline.svelte";
import { recentsStore } from "$lib/stores/recents.svelte";
import { activeKimpayGlobal } from "$lib/stores/activeKimpayGlobal.svelte";
import {
    type Kimpay,
    type Expense,
    type Participant,
    asKimpay,
    asExpense,
    asParticipant,
} from "$lib/types";
import { calculateDebts, type Transaction } from "$lib/balance";
import type { RecordSubscription, RecordModel } from "pocketbase";
import { getExchangeRates, DEFAULT_CURRENCY } from "$lib/services/currency";
import { SvelteSet } from "svelte/reactivity";

export class ActiveKimpay {
    // Raw State
    kimpay = $state<Kimpay | null>(null);
    expenses = $state<Expense[]>([]);
    participants = $state<Participant[]>([]);
    loading = $state(true);
    error = $state<string | null>(null);
    exchangeRates = $state<Record<string, number>>({});

    // Track pending expense IDs to avoid duplicate from realtime events
    private pendingExpenseIds = new SvelteSet<string>();

    // Derived State
    id: string;

    // Calculate balances for each participant (Positive = is owed, Negative = owes)
    balances = $derived.by(() => {
        const bal: Record<string, number> = {};
        this.participants.forEach((p) => (bal[p.id] = 0));

        for (const expense of this.expenses) {
            const amount = expense.amount;
            const payerId = expense.payer;

            // If involved is empty/null, it usually means everyone (legacy) or no one?
            // In Kimpay logic, usually empty involved means everyone.
            let involvedIds = expense.involved;
            if (!involvedIds || involvedIds.length === 0) {
                involvedIds = this.participants.map((p) => p.id);
            }

            // Filter out involved IDs that are not in the participants list anymore
            involvedIds = involvedIds.filter((id) => bal[id] !== undefined);

            if (involvedIds.length === 0) continue;

            const splitAmount = amount / involvedIds.length;

            if (bal[payerId] !== undefined) {
                bal[payerId] += amount;
            }

            involvedIds.forEach((id) => {
                if (bal[id] !== undefined) {
                    bal[id] -= splitAmount;
                }
            });
        }
        return bal;
    });

    totalAmount = $derived(
        this.expenses.reduce(
            (sum, e) => sum + (e.is_reimbursement ? 0 : e.amount),
            0
        )
    );

    // Transactions calculated with multi-currency support
    transactions = $derived<Transaction[]>(
        calculateDebts(
            this.expenses, 
            this.participants, 
            this.kimpay?.currency ?? DEFAULT_CURRENCY,
            this.exchangeRates
        )
    );

    myParticipantId = $state<string | null>(null);

    myBalance = $derived.by(() => {
        const myId = this.myParticipantId;
        if (!myId || !this.balances[myId]) return 0;
        return this.balances[myId];
    });

    constructor(kimpayId: string) {
        this.id = kimpayId;
        this.init();
    }

    async init() {
        this.loading = true;

        // 1. Cache-First: Load from local storage immediately
        const cached = await storageService.getKimpayData(this.id);
        if (cached) {
            // Load identity from cached data
            this.myParticipantId = cached.myParticipantId || null;
            this.updateStateFromData(cached);
            this.loading = false; // Show cached data immediately
        } else {
            // Fallback: try to get identity separately (for migration compatibility)
            this.myParticipantId = await storageService.getMyParticipantId(this.id);
        }

        // 2. Network: Fetch fresh data
        try {
            const freshData = await pb.collection("kimpays").getOne(this.id, {
                expand: "expenses_via_kimpay,participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved",
            });

            const kimpayData = asKimpay(freshData);
            this.updateStateFromData(kimpayData);

            // Save to cache
            await storageService.saveKimpayData(this.id, kimpayData);

            // Update Recents list
            recentsStore.addRecentKimpay({
                id: freshData.id,
                name: freshData.name,
                icon: freshData.icon,
                created_by: freshData.created_by,
            });
        } catch (e) {
            console.error("Failed to load kimpay", e);
            if (!cached) {
                this.error = "Failed to load kimpay";
            }
        } finally {
            this.loading = false;
        }

        // 3. Realtime Subscription
        this.subscribe();

        // 4. Fetch exchange rates (non-blocking for multi-currency balance)
        getExchangeRates()
            .then(rates => { this.exchangeRates = rates; })
            .catch(err => console.warn("Failed to fetch exchange rates", err));
    }

    private updateStateFromData(data: Kimpay) {
        this.kimpay = data;
        // Extract expanded relations
        // Note: PocketBase returns 'expand' property.
        // We need to be careful: if we save to localStorage, we save the whole object with expand.

        if (data.expand) {
            this.expenses = data.expand.expenses_via_kimpay || [];
            this.participants = data.expand.participants_via_kimpay || [];
        }

        // Update global store for navbar
        this.updateGlobalStore();
    }

    private updateGlobalStore() {
        const me = this.participants.find((p) => p.id === this.myParticipantId) || null;
        activeKimpayGlobal.set(this.kimpay, me);
    }

    async subscribe() {
        // Subscribe to the main kimpay record (for name changes, etc)
        await pb.collection("kimpays").subscribe(this.id, async (e) => {
            if (e.action === "update") {
                // We need to be careful not to overwrite expenses/participants if they are not in the event
                // Usually update event only has the changed fields of the record itself.
                // So we just update the kimpay info.
                this.kimpay = { ...this.kimpay, ...e.record } as Kimpay;
            } else if (e.action === "delete") {
                this.error = "Kimpay deleted";
                this.kimpay = null;
            }
        });

        // Subscribe to expenses
        // We can't easily subscribe to "expenses where kimpay = ID" efficiently without a filter
        // But PocketBase allows subscribing to a collection with a filter.
        await pb.collection("expenses").subscribe("*", (e) => {
            if (e.record.kimpay === this.id) {
                this.handleExpenseEvent(e);
            }
        });

        // Subscribe to participants
        await pb.collection("participants").subscribe("*", (e) => {
            if (e.record.kimpay === this.id) {
                this.handleParticipantEvent(e);
            }
        });
    }

    private handleExpenseEvent(e: RecordSubscription<RecordModel>) {
        const record = asExpense(e.record);
        if (e.action === "create") {
            // Ignore if this is a pending expense we're creating (avoid duplicates)
            if (this.pendingExpenseIds.has(record.id)) {
                this.pendingExpenseIds.delete(record.id);
                return;
            }
            
            // Check if we already have it by ID
            if (this.expenses.find((ex) => ex.id === record.id)) {
                return;
            }
            
            // Check if we have a temp expense that should be replaced
            // (matching description, amount, and payer within a short time window)
            const tempExpenseIndex = this.expenses.findIndex((ex) => 
                ex.id.startsWith("temp_") && 
                ex.description === record.description && 
                ex.amount === record.amount &&
                ex.payer === record.payer
            );
            
            if (tempExpenseIndex !== -1) {
                // Replace temp with real record
                this.expenses = this.expenses.map((ex, i) => 
                    i === tempExpenseIndex ? record : ex
                );
            } else {
                // Truly new expense from another user/device
                this.expenses = [record, ...this.expenses];
            }
        } else if (e.action === "update") {
            this.expenses = this.expenses.map((ex) =>
                ex.id === record.id ? record : ex
            );
        } else if (e.action === "delete") {
            this.expenses = this.expenses.filter((ex) => ex.id !== record.id);
        }
        this.persist();
    }

    private handleParticipantEvent(e: RecordSubscription<RecordModel>) {
        const record = asParticipant(e.record);
        if (e.action === "create") {
            if (!this.participants.find((p) => p.id === record.id)) {
                this.participants = [...this.participants, record];
            }
        } else if (e.action === "update") {
            this.participants = this.participants.map((p) =>
                p.id === record.id ? record : p
            );
        } else if (e.action === "delete") {
            this.participants = this.participants.filter(
                (p) => p.id !== record.id
            );
        }
        this.persist();
    }

    // Persist current state to local storage
    private persist() {
        if (this.kimpay) {
            const fullData = {
                ...this.kimpay,
                expand: {
                    expenses_via_kimpay: $state.snapshot(this.expenses),
                    participants_via_kimpay: $state.snapshot(this.participants),
                },
            };
            storageService.saveKimpayData(this.id, fullData);
        }
    }

    // --- Actions ---

    async addExpense(data: Partial<Expense>, photos: File[] = []) {
        // 1. Build expand from in-memory participants for immediate display
        const payerParticipant = this.participants.find(p => p.id === data.payer);
        const involvedParticipants = data.involved 
            ? this.participants.filter(p => data.involved!.includes(p.id))
            : [];

        // 2. Optimistic Update with expand
        const tempId = "temp_" + Date.now();
        const optimisticExpense = {
            ...data,
            id: tempId,
            kimpay: this.id,
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            created: new Date().toISOString(),
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            updated: new Date().toISOString(),
            collectionId: "expenses",
            collectionName: "expenses",
            expand: {
                payer: payerParticipant,
                involved: involvedParticipants,
            }
        } as Expense;

        this.expenses = [optimisticExpense, ...this.expenses];
        this.persist();

        // 3. Offline / Online Handling
        if (offlineStore.isOffline) {
            // Note: Photos are not supported offline (UI prevents adding them)
            // IMPORTANT: Use $state.snapshot to convert Svelte 5 Proxies to plain objects
            // IndexedDB cannot clone Proxy objects
            const plainData = $state.snapshot(data);
            offlineStore.queueAction(
                "CREATE_EXPENSE",
                { ...plainData, kimpay: this.id },
                this.id,
                tempId
            );
            return;
        }

        try {
            // Prepare FormData
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach((v) => formData.append(key, v));
                } else {
                    formData.append(key, String(value));
                }
            });
            photos.forEach((photo) => formData.append("photos", photo));
            formData.append("kimpay", this.id);

            // Create and immediately fetch with expand for complete data
            const record = await pb.collection("expenses").create(formData, {
                expand: "payer,involved"
            });

            // Mark this ID as pending so realtime event is ignored
            this.pendingExpenseIds.add(record.id);

            // Replace temp with real
            this.expenses = this.expenses.map((e) =>
                e.id === tempId ? asExpense(record) : e
            );
            this.persist();
        } catch (e) {
            console.error("Failed to create expense", e);
            // Rollback
            this.expenses = this.expenses.filter((e) => e.id !== tempId);
            this.persist();
            throw e;
        }
    }

    async updateExpense(
        expenseId: string,
        data: Partial<Expense>,
        newPhotos: File[] = [],
        deletedPhotos: string[] = []
    ) {
        // 1. Optimistic Update
        const originalExpense = this.expenses.find((e) => e.id === expenseId);
        if (!originalExpense) throw new Error("Expense not found");

        const updatedExpense = {
            ...originalExpense,
            ...data,
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            updated: new Date().toISOString(),
        };

        this.expenses = this.expenses.map((e) =>
            e.id === expenseId ? updatedExpense : e
        );
        this.persist();

        // 2. Offline / Online Handling
        if (offlineStore.isOffline) {
            offlineStore.queueAction(
                "UPDATE_EXPENSE",
                { id: expenseId, ...data, newPhotos, deletedPhotos },
                this.id
            );
            return;
        }

        try {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach((v) => formData.append(key, v));
                } else {
                    formData.append(key, String(value));
                }
            });
            newPhotos.forEach((photo) => formData.append("photos", photo));

            deletedPhotos.forEach((photo) => {
                formData.append("photos-", photo);
            });

            const record = await pb
                .collection("expenses")
                .update(expenseId, formData, {
                    expand: "payer,involved"
                });

            this.expenses = this.expenses.map((e) =>
                e.id === expenseId ? asExpense(record) : e
            );
            this.persist();
        } catch (e) {
            console.error("Failed to update expense", e);
            // Rollback
            this.expenses = this.expenses.map((e) =>
                e.id === expenseId ? originalExpense : e
            );
            this.persist();
            throw e;
        }
    }

    async deleteExpense(expenseId: string) {
        const previousExpenses = this.expenses;
        this.expenses = this.expenses.filter((e) => e.id !== expenseId);
        this.persist();

        if (offlineStore.isOffline) {
            offlineStore.queueAction(
                "DELETE_EXPENSE",
                { id: expenseId },
                this.id
            );
            return;
        }

        try {
            await pb.collection("expenses").delete(expenseId);
        } catch (e) {
            console.error("Failed to delete expense", e);
            this.expenses = previousExpenses;
            this.persist();
            throw e;
        }
    }

    async addParticipant(name: string) {
        // 1. Optimistic
        const tempId = "temp_p_" + Date.now();
        const optimisticParticipant = {
            id: tempId,
            name,
            kimpay: this.id,
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            created: new Date().toISOString(),
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            updated: new Date().toISOString(),
            collectionId: "participants",
            collectionName: "participants",
        } as Participant;

        this.participants = [...this.participants, optimisticParticipant];
        this.persist();

        // 2. Offline / Online
        if (offlineStore.isOffline) {
            offlineStore.queueAction(
                "CREATE_PARTICIPANT",
                { name, kimpay: this.id },
                this.id,
                tempId
            );
            return optimisticParticipant;
        }

        try {
            const record = await pb.collection("participants").create({
                name,
                kimpay: this.id,
            });

            this.participants = this.participants.map((p) =>
                p.id === tempId ? asParticipant(record) : p
            );
            this.persist();
            return asParticipant(record);
        } catch (e) {
            console.error("Failed to add participant", e);
            this.participants = this.participants.filter(
                (p) => p.id !== tempId
            );
            this.persist();
            throw e;
        }
    }

    async updateKimpay(name: string, icon: string) {
        if (!this.kimpay) return;
        const previous = { ...this.kimpay };
        this.kimpay = { ...this.kimpay, name, icon };
        this.persist();

        // Update recentsStore for immediate sync to homepage
        recentsStore.updateRecentKimpay({ id: this.id, name, icon });

        if (offlineStore.isOffline) {
            offlineStore.queueAction(
                "UPDATE_KIMPAY",
                { name, icon },
                this.id
            );
            return;
        }

        try {
            await pb.collection("kimpays").update(this.id, { name, icon });
        } catch (e) {
            this.kimpay = previous;
            this.persist();
            // Revert recentsStore update
            const revert: { id: string; name: string; icon?: string } = { id: this.id, name: previous.name };
            if (previous.icon) revert.icon = previous.icon;
            recentsStore.updateRecentKimpay(revert);
            throw e;
        }
    }

    async deleteKimpay() {
        if (offlineStore.isOffline) {
            offlineStore.queueAction("DELETE_KIMPAY", {}, this.id);
            return;
        }
        await pb.collection("kimpays").delete(this.id);
    }

    async deleteParticipant(participantId: string) {
        const previous = this.participants;
        this.participants = this.participants.filter(
            (p) => p.id !== participantId
        );
        this.persist();

        if (offlineStore.isOffline) {
            offlineStore.queueAction(
                "DELETE_PARTICIPANT",
                { id: participantId },
                this.id
            );
            return;
        }

        try {
            await pb.collection("participants").delete(participantId);
        } catch (e) {
            this.participants = previous;
            this.persist();
            throw e;
        }
    }

    destroy() {
        pb.collection("kimpays").unsubscribe(this.id);
        pb.collection("expenses").unsubscribe("*");
        pb.collection("participants").unsubscribe("*");
        // Note: We don't reset activeKimpayGlobal here because the effect cleanup
        // is called on every navigation, even within the same Kimpay.
        // The navbar uses isInKimpayContext to handle showing/hiding the Kimpay info.
    }
}
