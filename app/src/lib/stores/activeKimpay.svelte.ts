import { createContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { pb } from "#lib/pocketbase.js";
import { storageService } from "#lib/services/storage.js";
import { offlineStore, QUEUED } from "#lib/stores/offline.svelte.js";
import { recentsStore } from "#lib/stores/recents.svelte.js";
import { participantService } from "#lib/services/participant.js";
import { kimpayService } from "#lib/services/kimpay.js";
import {
    type Kimpay,
    type Expense,
    type Participant,
    asExpense,
    asParticipant,
} from "#lib/types.js";
import { calculateBalances, calculateDebts, totalSpent, type Transaction } from "#lib/balance.js";
import { getExchangeRates, DEFAULT_CURRENCY } from "#lib/services/currency.js";
import { objectToFormData } from "#lib/utils/formData.js";
import { generatePocketBaseId } from "#lib/utils/id.js";

/**
 * The `/k/[id]` layout provides its ActiveKimpay to every page and component
 * below it: `const ctx = getActiveKimpayContext(); ctx.value`.
 * (`value` is a getter: the instance changes when navigating between Kimpays.)
 */
export const [getActiveKimpayContext, setActiveKimpayContext] =
    createContext<{ readonly value: ActiveKimpay }>();

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

    // Net spending of the group (expenses minus money received), converted
    // to the Kimpay's currency so groups mixing currencies show a correct total.
    totalAmount = $derived(
        totalSpent(
            this.expenses,
            this.kimpay?.currency ?? DEFAULT_CURRENCY,
            this.exchangeRates,
        ),
    );

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

    /**
     * Expenses already seen on this device: those of the cached copy when the
     * group was opened (what I saw on my last visit), plus the ones added here.
     * null on a first visit, where nothing counts as new.
     */
    seenIds = $state<SvelteSet<string> | null>(null);

    /** Everything listed now counts as seen. */
    markAllSeen() {
        this.seenIds = new SvelteSet(this.expenses.map((e) => e.id));
    }

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
            if (action.kimpayId !== this.id) continue;
            if (
                action.type === "CREATE_EXPENSE" ||
                action.type === "CREATE_PARTICIPANT"
            ) {
                this.pendingIds.add(action.id);
            } else if (action.type === "CREATE_KIMPAY") {
                // The whole group was created offline (see kimpayService).
                const { creator, participants } = action.payload as {
                    creator?: { id: string };
                    participants?: { id: string }[];
                };
                for (const p of [creator, ...(participants ?? [])]) {
                    if (p) this.pendingIds.add(p.id);
                }
            }
        }

        // 1. Cache-First: Load from local storage immediately
        const cached = await storageService.getKimpayData(this.id);
        if (this.destroyed) return;
        this.myParticipantId = cached?.myParticipantId || null;
        // A cache entry may only hold the identity (no data fetched yet).
        if (cached?.expand) {
            this.seenIds = new SvelteSet((cached.expand.expenses_via_kimpay ?? []).map((e) => e.id));
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
        const participants = data.expand?.participants_via_kimpay ?? [];
        // Payer and involved participants, resolved here rather than
        // expanded by the server for every expense.
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup
        const byId = new Map(participants.map((p) => [p.id, p]));
        const expenses = (data.expand?.expenses_via_kimpay ?? []).map((e) => {
            const payer = byId.get(e.payer);
            const involved = (e.involved ?? []).flatMap((id) => byId.get(id) ?? []);
            return { ...e, expand: { ...(payer && { payer }), involved } };
        });

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
        // Also after the offline queue has been replayed. Items the server
        // rejected are no longer pending: the refetch drops them.
        const unsubSynced = offlineStore.onSynced((rejected) => {
            for (const action of rejected) this.pendingIds.delete(action.id);
            this.scheduleRefetch();
        });
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
            const fresh = await kimpayService.getWithData(this.id);
            if (this.destroyed || seq !== this.fetchSeq) return;

            this.applyData(fresh);
            this.error = null;
            this.persist();

            recentsStore.addRecentKimpay({
                id: fresh.id,
                name: fresh.name,
                created_by: fresh.created_by,
                ...(fresh.icon && { icon: fresh.icon }),
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
        this.seenIds?.add(id);
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

        // 3. Online, or queued (photos are not stored offline: the UI
        // prevents adding them, and such a write fails without network).
        try {
            const record = await offlineStore.write(
                () => {
                    const formData = objectToFormData({ ...data, id, kimpay: this.id });
                    photos.forEach((photo) => formData.append("photos", photo));
                    // Create and immediately fetch with expand for complete data
                    return pb.collection("expenses").create(formData, {
                        expand: "payer,involved",
                    });
                },
                photos.length > 0
                    ? null
                    : {
                          type: "CREATE_EXPENSE",
                          payload: { ...data, kimpay: this.id },
                          kimpayId: this.id,
                          id,
                      },
            );
            if (record === QUEUED) return;

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

        // 2. Online, or queued (new photos are not stored offline)
        try {
            const record = await offlineStore.write(
                () => {
                    const formData = objectToFormData(data);
                    newPhotos.forEach((photo) => formData.append("photos", photo));
                    deletedPhotos.forEach((photo) => {
                        formData.append("photos-", photo);
                    });
                    return pb.collection("expenses").update(expenseId, formData, {
                        expand: "payer,involved",
                    });
                },
                newPhotos.length > 0
                    ? null
                    : {
                          type: "UPDATE_EXPENSE",
                          payload: { id: expenseId, ...data, deletedPhotos },
                          kimpayId: this.id,
                      },
            );
            if (record === QUEUED) return;

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

        try {
            await offlineStore.write(
                () => pb.collection("expenses").delete(expenseId),
                { type: "DELETE_EXPENSE", payload: { id: expenseId }, kimpayId: this.id },
            );
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

        // 2. Online, or queued
        try {
            const record = await offlineStore.write(
                () => pb.collection("participants").create({ id, name, kimpay: this.id }),
                {
                    type: "CREATE_PARTICIPANT",
                    payload: { id, name, kimpay: this.id },
                    kimpayId: this.id,
                    id,
                },
            );
            if (record === QUEUED) return optimisticParticipant;

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

        try {
            await offlineStore.write(
                () => pb.collection("kimpays").update(this.id, { name, icon }),
                { type: "UPDATE_KIMPAY", payload: { name, icon }, kimpayId: this.id },
            );
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
        await offlineStore.write(
            () => pb.collection("kimpays").delete(this.id),
            { type: "DELETE_KIMPAY", payload: {}, kimpayId: this.id },
        );
    }

    async deleteParticipant(participantId: string) {
        const previous = this.participants;
        this.participants = this.participants.filter(
            (p) => p.id !== participantId,
        );
        this.persist();

        try {
            await offlineStore.write(
                () => pb.collection("participants").delete(participantId),
                {
                    type: "DELETE_PARTICIPANT",
                    payload: { id: participantId },
                    kimpayId: this.id,
                },
            );
        } catch (e) {
            this.participants = previous;
            this.persist();
            throw e;
        }
    }

    /** Set the payment handles (PayPal.me, Revolut.me) of the current identity. */
    async updateMyPaymentHandles(handles: { paypal: string; revolut: string }) {
        const myId = this.myParticipantId;
        if (!myId) return;

        const record = await pb.collection("participants").update(myId, handles);
        this.participants = this.participants.map((p) =>
            p.id === myId ? { ...p, ...handles, updated: record.updated } : p,
        );
        this.persist();
    }

    /**
     * Create (new token) or disable ("") the read-only summary link.
     * Online only: the link is useless until the server knows the token.
     */
    async setReadonlyToken(token: string) {
        if (!this.kimpay) return;
        await pb.collection("kimpays").update(this.id, { readonly_token: token });
        this.kimpay = { ...this.kimpay, readonly_token: token };
        this.persist();
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
