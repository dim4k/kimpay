import { pb } from "$lib/pocketbase";
import { storageService } from "$lib/services/storage";
import { offlineStore } from "$lib/stores/offline.svelte";
import { recentsStore } from "$lib/stores/recents.svelte";
import { participantService } from "$lib/services/participant";
import {
    type Kimpay,
    type Expense,
    type Participant,
    asKimpay,
    asExpense,
    asParticipant,
} from "$lib/types";
import { calculateBalances, calculateDebts, type Transaction } from "$lib/balance";
import { getExchangeRates, DEFAULT_CURRENCY, convert } from "$lib/services/currency";
import { objectToFormData } from "$lib/utils/formData";

// Relations expanded when fetching a Kimpay (full graph for the active view).
const KIMPAY_EXPAND =
    "expenses_via_kimpay,participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved";

export class ActiveKimpay {
    // Raw State
    kimpay = $state<Kimpay | null>(null);
    expenses = $state<Expense[]>([]);
    participants = $state<Participant[]>([]);
    loading = $state(true);
    error = $state<string | null>(null);
    exchangeRates = $state<Record<string, number>>({});

    // Store unsubscribe functions for cleanup
    private unsubscribeFns: Array<() => void> = [];
    // Debounce timer for coalescing realtime-triggered refetches
    private refetchTimer: ReturnType<typeof setTimeout> | null = null;

    // Derived State
    id: string;

    // Calculate balances for each participant (Positive = is owed, Negative = owes).
    // Converted to the Kimpay's currency, sharing the single source of truth
    // used to derive the settlement transactions below.
    balances = $derived.by(() =>
        calculateBalances(
            this.expenses,
            this.participants,
            this.kimpay?.currency ?? DEFAULT_CURRENCY,
            this.exchangeRates,
        ),
    );

    // Sum of all non-reimbursement expenses, converted to the Kimpay's
    // currency so groups mixing currencies show a correct total.
    totalAmount = $derived.by(() => {
        const target = this.kimpay?.currency ?? DEFAULT_CURRENCY;
        return this.expenses.reduce(
            (sum, e) =>
                sum +
                (e.is_reimbursement
                    ? 0
                    : convert(
                          e.amount,
                          e.currency || DEFAULT_CURRENCY,
                          target,
                          this.exchangeRates,
                      )),
            0,
        );
    });

    // Transactions calculated with multi-currency support
    transactions = $derived<Transaction[]>(
        calculateDebts(
            this.expenses,
            this.participants,
            this.kimpay?.currency ?? DEFAULT_CURRENCY,
            this.exchangeRates,
        ),
    );

    myParticipantId = $state<string | null>(null);

    myBalance = $derived.by(() => {
        const myId = this.myParticipantId;
        if (!myId || this.balances[myId] === undefined) return 0;
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
            this.myParticipantId = await storageService.getMyParticipantId(
                this.id,
            );
        }

        // 2. Network: Fetch fresh data
        try {
            const freshData = await pb.collection("kimpays").getOne(this.id, {
                expand: KIMPAY_EXPAND,
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
            .then((rates) => {
                this.exchangeRates = rates;
            })
            .catch((err) =>
                console.warn("Failed to fetch exchange rates", err),
            );
    }

    private updateStateFromData(data: Kimpay, preserveTemp = false) {
        this.kimpay = data;
        // Extract expanded relations
        // Note: PocketBase returns 'expand' property.
        // We need to be careful: if we save to localStorage, we save the whole object with expand.

        if (data.expand) {
            const freshExpenses = data.expand.expenses_via_kimpay || [];
            const freshParticipants =
                data.expand.participants_via_kimpay || [];

            if (preserveTemp) {
                // Keep not-yet-synced optimistic items (temp IDs) that the
                // server fetch doesn't know about yet, to avoid them flashing
                // out when a realtime refetch lands mid-creation.
                const tempExpenses = this.expenses.filter((e) =>
                    e.id.startsWith("temp_"),
                );
                const tempParticipants = this.participants.filter((p) =>
                    p.id.startsWith("temp_p_"),
                );
                this.expenses = [...tempExpenses, ...freshExpenses];
                this.participants = [...freshParticipants, ...tempParticipants];
            } else {
                this.expenses = freshExpenses;
                this.participants = freshParticipants;
            }
        }
    }

    async subscribe() {
        // Single-record subscription (uses the kimpays ViewRule, which stays
        // public-by-UUID). A server hook "touches" the parent Kimpay whenever an
        // expense or participant changes, so this one event covers the whole
        // group without an open listRule on the child collections.
        const unsubKimpay = await pb
            .collection("kimpays")
            .subscribe(this.id, (e) => {
                if (e.action === "update") {
                    // Coalesce bursts of child changes into a single refetch.
                    this.scheduleRefetch();
                } else if (e.action === "delete") {
                    this.error = "Kimpay deleted";
                    this.kimpay = null;
                }
            });

        this.unsubscribeFns = [unsubKimpay];
    }

    private scheduleRefetch() {
        if (this.refetchTimer) clearTimeout(this.refetchTimer);
        this.refetchTimer = setTimeout(() => {
            this.refetchTimer = null;
            this.refetch();
        }, 300);
    }

    private async refetch() {
        try {
            const fresh = await pb.collection("kimpays").getOne(this.id, {
                expand: KIMPAY_EXPAND,
            });
            const data = asKimpay(fresh);
            // Preserve not-yet-synced optimistic items during the refetch.
            this.updateStateFromData(data, true);
            await storageService.saveKimpayData(this.id, data);
        } catch (e) {
            console.error("Failed to refetch kimpay", e);
        }
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
        const payerParticipant = this.participants.find(
            (p) => p.id === data.payer,
        );
        const involvedParticipants = data.involved
            ? this.participants.filter((p) => data.involved!.includes(p.id))
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
            },
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
                tempId,
            );
            return;
        }

        try {
            // Prepare FormData
            const formData = objectToFormData(data);
            photos.forEach((photo) => formData.append("photos", photo));
            formData.append("kimpay", this.id);

            // Create and immediately fetch with expand for complete data
            const record = await pb.collection("expenses").create(formData, {
                expand: "payer,involved",
            });

            // Replace temp with real
            this.expenses = this.expenses.map((e) =>
                e.id === tempId ? asExpense(record) : e,
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
        deletedPhotos: string[] = [],
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
            e.id === expenseId ? updatedExpense : e,
        );
        this.persist();

        // 2. Offline / Online Handling
        if (offlineStore.isOffline) {
            offlineStore.queueAction(
                "UPDATE_EXPENSE",
                { id: expenseId, ...data, newPhotos, deletedPhotos },
                this.id,
            );
            return;
        }

        try {
            const formData = objectToFormData(data);
            newPhotos.forEach((photo) => formData.append("photos", photo));

            deletedPhotos.forEach((photo) => {
                formData.append("photos-", photo);
            });

            const record = await pb
                .collection("expenses")
                .update(expenseId, formData, {
                    expand: "payer,involved",
                });

            this.expenses = this.expenses.map((e) =>
                e.id === expenseId ? asExpense(record) : e,
            );
            this.persist();
        } catch (e) {
            console.error("Failed to update expense", e);
            // Rollback
            this.expenses = this.expenses.map((e) =>
                e.id === expenseId ? originalExpense : e,
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
                this.id,
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
                tempId,
            );
            return optimisticParticipant;
        }

        try {
            const record = await pb.collection("participants").create({
                name,
                kimpay: this.id,
            });

            this.participants = this.participants.map((p) =>
                p.id === tempId ? asParticipant(record) : p,
            );
            this.persist();
            return asParticipant(record);
        } catch (e) {
            console.error("Failed to add participant", e);
            this.participants = this.participants.filter(
                (p) => p.id !== tempId,
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
            offlineStore.queueAction("UPDATE_KIMPAY", { name, icon }, this.id);
            return;
        }

        try {
            await pb.collection("kimpays").update(this.id, { name, icon });
        } catch (e) {
            this.kimpay = previous;
            this.persist();
            // Revert recentsStore update
            const revert: { id: string; name: string; icon?: string } = {
                id: this.id,
                name: previous.name,
            };
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
            (p) => p.id !== participantId,
        );
        this.persist();

        if (offlineStore.isOffline) {
            offlineStore.queueAction(
                "DELETE_PARTICIPANT",
                { id: participantId },
                this.id,
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

    async updateMyAvatar(file: File) {
        const myId = this.myParticipantId;
        if (!myId) return;

        const updated = await participantService.updateAvatar(myId, file);

        // Optimistically update the participant in-memory so the navbar (and any
        // other consumer of `participants`) reflects the new avatar immediately.
        this.participants = this.participants.map((p) =>
            p.id === myId ? { ...p, avatar: updated.avatar ?? "" } : p,
        );
        this.persist();
    }

    destroy() {
        if (this.refetchTimer) {
            clearTimeout(this.refetchTimer);
            this.refetchTimer = null;
        }
        this.unsubscribeFns.forEach((fn) => fn());
        this.unsubscribeFns = [];
        // The activeKimpayGlobal instance reference is managed by the Kimpay
        // layout (set on creation, reset on unmount).
    }
}
