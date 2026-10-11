import { createContext } from "svelte";
import { pb } from "#lib/pocketbase.js";
import { storageService } from "#lib/services/storage.js";
import { offlineStore } from "#lib/stores/offline.svelte.js";
import { recentsStore } from "#lib/stores/recents.svelte.js";
import { participantService } from "#lib/services/participant.js";
import {
    type Kimpay,
    type Expense,
    type Participant,
    asKimpay,
    asExpense,
    asParticipant,
} from "#lib/types.js";
import { calculateBalances, calculateDebts, type Transaction } from "#lib/balance.js";
import { getExchangeRates, DEFAULT_CURRENCY, convert } from "#lib/services/currency.js";
import { objectToFormData } from "#lib/utils/formData.js";
import { generatePocketBaseId } from "#lib/utils/id.js";

/**
 * The `/k/[id]` layout provides its ActiveKimpay to every page and component
 * below it: `const ctx = getActiveKimpayContext(); ctx.value`.
 * (`value` is a getter: the instance changes when navigating between Kimpays.)
 */
export const [getActiveKimpayContext, setActiveKimpayContext] =
    createContext<{ readonly value: ActiveKimpay }>();

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
    private destroyed = false;
    // Only the latest fetch may apply its result (responses can arrive out of order).
    private fetchSeq = 0;
    // IDs created locally that the server has not returned yet (request in
    // flight or queued offline). They are kept across refetches until the
    // server knows them. IDs are generated client-side, so no remapping.
    // Bookkeeping only (never rendered), hence a plain Set.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    private pendingIds = new Set<string>();

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

    /** Participants by id, for lookups in lists (balance, exports...). */
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt, never mutated
    participantsById = $derived(new Map(this.participants.map((p) => [p.id, p])));

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

        // Items created offline (still in the queue) must survive refetches.
        const queue = await storageService.getPendingActions();
        for (const action of queue) {
            if (
                action.kimpayId === this.id &&
                (action.type === "CREATE_EXPENSE" ||
                    action.type === "CREATE_PARTICIPANT")
            ) {
                this.pendingIds.add(action.id);
            }
        }

        // 1. Cache-First: Load from local storage immediately
        const cached = await storageService.getKimpayData(this.id);
        if (this.destroyed) return;
        this.myParticipantId = cached?.myParticipantId || null;
        // A cache entry may only hold the identity (no data fetched yet).
        if (cached?.expand) {
            this.applyData(cached);
            this.loading = false; // Show cached data immediately
        }

        // 2. Realtime first, so no change between the fetch and the
        // subscription can be missed.
        this.subscribe();
        this.watchConnectivity();

        // 3. Network: Fetch fresh data
        await this.refetch();

        // 4. Fetch exchange rates (non-blocking for multi-currency balance)
        getExchangeRates()
            .then((rates) => {
                this.exchangeRates = rates;
            })
            .catch((err) =>
                console.warn("Failed to fetch exchange rates", err),
            );
    }

    private applyData(data: Kimpay) {
        const expenses = data.expand?.expenses_via_kimpay ?? [];
        const participants = data.expand?.participants_via_kimpay ?? [];

        // Pending items the server now returns are confirmed.
        for (const item of [...expenses, ...participants]) {
            this.pendingIds.delete(item.id);
        }
        const pending = <T extends { id: string }>(list: T[]) =>
            list.filter((item) => this.pendingIds.has(item.id));

        this.kimpay = data;
        this.expenses = [...pending(this.expenses), ...expenses];
        this.participants = [...participants, ...pending(this.participants)];
    }

    private async subscribe() {
        try {
            // Single-record subscription (uses the kimpays ViewRule, which stays
            // public-by-UUID). A server hook "touches" the parent Kimpay whenever
            // an expense or participant changes, so this one event covers the
            // whole group without an open listRule on the child collections.
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

            // PocketBase does not replay events missed while the realtime
            // connection was down: resync on every (re)connection.
            const unsubConnect = await pb.realtime.subscribe("PB_CONNECT", () =>
                this.scheduleRefetch(),
            );

            const unsubs = [unsubKimpay, unsubConnect];
            if (this.destroyed) unsubs.forEach((fn) => fn());
            else this.unsubscribeFns.push(...unsubs);
        } catch (e) {
            console.warn("Realtime subscription failed", e);
        }
    }

    /**
     * Browsers suspend background tabs/PWAs (and their realtime connection):
     * resync when the app comes back to the foreground or back online.
     */
    private watchConnectivity() {
        if (typeof window === "undefined") return;
        const onVisible = () => {
            if (document.visibilityState === "visible") this.scheduleRefetch();
        };
        const onOnline = () => this.scheduleRefetch();
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("online", onOnline);
        // Also after the offline queue has been replayed.
        const unsubSynced = offlineStore.onSynced(onOnline);
        this.unsubscribeFns.push(
            () => document.removeEventListener("visibilitychange", onVisible),
            () => window.removeEventListener("online", onOnline),
            unsubSynced,
        );
    }

    private scheduleRefetch() {
        if (this.destroyed) return;
        if (this.refetchTimer) clearTimeout(this.refetchTimer);
        this.refetchTimer = setTimeout(() => {
            this.refetchTimer = null;
            this.refetch();
        }, 300);
    }

    private async refetch() {
        if (this.destroyed || offlineStore.isOffline) {
            this.loading = false;
            return;
        }
        const seq = ++this.fetchSeq;
        try {
            // requestKey: null opts out of the SDK auto-cancellation, which
            // keys on method + path and would otherwise abort (or be aborted
            // by) any other getOne on this same Kimpay.
            const fresh = await pb.collection("kimpays").getOne(this.id, {
                expand: KIMPAY_EXPAND,
                requestKey: null,
            });
            if (this.destroyed || seq !== this.fetchSeq) return;

            this.applyData(asKimpay(fresh));
            this.error = null;
            this.persist();

            recentsStore.addRecentKimpay({
                id: fresh.id,
                name: fresh.name,
                icon: fresh.icon,
                created_by: fresh.created_by,
            });
        } catch (e) {
            if (this.destroyed || seq !== this.fetchSeq) return;
            console.error("Failed to load kimpay", e);
            if (!this.kimpay) this.error = "Failed to load kimpay";
        } finally {
            if (seq === this.fetchSeq) this.loading = false;
        }
    }

    // Persist current state to local storage
    private persist() {
        if (!this.kimpay) return;
        storageService.saveKimpayData(this.id, {
            ...$state.snapshot(this.kimpay),
            // Always written explicitly ("" = none), so a stale identity held
            // in `kimpay` can never overwrite the current one.
            myParticipantId: this.myParticipantId ?? "",
            expand: {
                expenses_via_kimpay: $state.snapshot(this.expenses),
                participants_via_kimpay: $state.snapshot(this.participants),
            },
        });
    }

    /** Select (or clear) the current device's identity in this Kimpay. */
    async setMyParticipant(participantId: string | null) {
        this.myParticipantId = participantId;
        await storageService.setMyParticipantId(this.id, participantId);
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

        // 2. Optimistic Update with expand. The ID is generated client-side
        // and sent to the server, so the optimistic item never needs remapping.
        const id = generatePocketBaseId();
        this.pendingIds.add(id);
        const optimisticExpense = {
            ...data,
            id,
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
            await offlineStore.queueAction(
                "CREATE_EXPENSE",
                { ...plainData, kimpay: this.id },
                this.id,
                id,
            );
            return;
        }

        try {
            // Prepare FormData
            const formData = objectToFormData({ ...data, id, kimpay: this.id });
            photos.forEach((photo) => formData.append("photos", photo));

            // Create and immediately fetch with expand for complete data
            const record = await pb.collection("expenses").create(formData, {
                expand: "payer,involved",
            });

            this.pendingIds.delete(id);
            this.expenses = this.expenses.map((e) =>
                e.id === id ? asExpense(record) : e,
            );
            this.persist();
        } catch (e) {
            console.error("Failed to create expense", e);
            // Rollback
            this.pendingIds.delete(id);
            this.expenses = this.expenses.filter((e) => e.id !== id);
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
        // 1. Optimistic (client-generated ID, see addExpense)
        const id = generatePocketBaseId();
        this.pendingIds.add(id);
        const optimisticParticipant = {
            id,
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
            await offlineStore.queueAction(
                "CREATE_PARTICIPANT",
                { id, name, kimpay: this.id },
                this.id,
                id,
            );
            return optimisticParticipant;
        }

        try {
            const record = await pb.collection("participants").create({
                id,
                name,
                kimpay: this.id,
            });

            this.pendingIds.delete(id);
            this.participants = this.participants.map((p) =>
                p.id === id ? asParticipant(record) : p,
            );
            this.persist();
            return asParticipant(record);
        } catch (e) {
            console.error("Failed to add participant", e);
            this.pendingIds.delete(id);
            this.participants = this.participants.filter((p) => p.id !== id);
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
        this.destroyed = true;
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
