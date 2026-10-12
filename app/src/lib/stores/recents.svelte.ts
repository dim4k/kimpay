import { pb } from "#lib/pocketbase.js";
import type { RecentKimpay, Participant } from "#lib/types.js";
import { asRecentKimpay } from "#lib/types.js";
import { storageService } from "#lib/services/storage.js";
import { offlineStore } from "#lib/stores/offline.svelte.js";
import { auth } from "#lib/stores/auth.svelte.js";
import { activeKimpayGlobal } from "#lib/stores/activeKimpayGlobal.svelte.js";
import { isNetworkError } from "#lib/utils/errors.js";

class RecentsStore {
    recentKimpays: RecentKimpay[] = $state([]);
    loading = $state(false);
    initialized = $state(false);

    // Loaded without the server (offline, or unreachable): validated and
    // subscribed to once back online.
    private needsServer = false;

    constructor() {
        offlineStore.onSynced(() => {
            if (this.needsServer && !this.loading) this.init(true);
        });
    }

    async init(force = false) {
        if ((this.initialized || this.loading) && !force) return;

        try {
            this.loading = true;
            
            // 1. Load from IndexedDB first
            const localIds = await storageService.getRecentKimpayIds();
            
            // Load from cache immediately for fast display
            if (localIds.length > 0) {
                await this.loadFromCache(localIds);
            }

            // Offline mode: stop here
            if (offlineStore.isOffline) {
                this.needsServer = true;
                this.initialized = true;
                return;
            }

            // 2. For logged-in users: also sync with their account
            const accountSynced = auth.user ? await this.syncWithAccount() : true;

            // 3. Validate and update local Kimpays with fresh data (read again:
            // the account sync may have added or forgotten some)
            const keptIds = await storageService.getRecentKimpayIds();
            const validated =
                keptIds.length > 0 ? await this.validateAndUpdateFromServer(keptIds) : true;

            this.needsServer = !accountSynced || !validated;
            this.initialized = true;

            // 4. Subscribe to realtime updates
            this.subscribeToKimpays();
        } catch (e) {
            console.error("Failed to load kimpays", e);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Merge the Kimpays linked to the user's account, and forget those left
     * from another device. Returns false when the server was unreachable.
     */
    private async syncWithAccount(): Promise<boolean> {
        const userId = auth.user!.id;
        let linked: Participant[];
        try {
            linked = await pb.collection("participants").getFullList<Participant>({
                filter: pb.filter("user = {:userId}", { userId }),
                sort: "-created",
                expand: "kimpay",
                requestKey: null,
            });
        } catch (e) {
            console.warn("Could not fetch account kimpays", e);
            return !isNetworkError(e);
        }

        try {
            for (const participant of linked) {
                const kimpay = participant.expand?.kimpay;
                if (!kimpay) continue;

                // Check if we already have this kimpay
                const existing = this.recentKimpays.find(k => k.id === kimpay.id);
                if (!existing) {
                    // Add to list
                    const recentKimpay: RecentKimpay = {
                        id: kimpay.id,
                        name: kimpay.name,
                        created_by: kimpay.created_by
                    };
                    if (kimpay.icon) recentKimpay.icon = kimpay.icon;
                    this.recentKimpays = [recentKimpay, ...this.recentKimpays];
                    
                    // Save to IndexedDB with participant ID
                    await storageService.setMyParticipantId(kimpay.id, participant.id);
                }
            }

            // Left from another device: my identity in the group was linked to
            // this account on my last visit, and the account has no participant
            // there anymore (only its owner can unlink it). Groups only opened
            // by link (identity never linked) are kept.
            const linkedKimpays = new Set(linked.map((p) => p.kimpay));
            for (const id of await storageService.getRecentKimpayIds()) {
                if (linkedKimpays.has(id) || activeKimpayGlobal.instance?.id === id) continue;
                const cached = await storageService.getKimpayData(id);
                const me = cached?.expand?.participants_via_kimpay?.find(
                    (p) => p.id === cached.myParticipantId
                );
                if (me?.user === userId) await this.forget(id);
            }
        } catch (e) {
            console.warn("Could not sync account kimpays", e);
        }
        return true;
    }

    /**
     * Validate local Kimpays against server and update with fresh data.
     * Returns false when the server was unreachable.
     */
    private async validateAndUpdateFromServer(ids: string[]): Promise<boolean> {
        const promises = ids.map((id) =>
            pb
                .collection("kimpays")
                .getOne(id, { requestKey: null })
                .then((data) => ({
                    id,
                    data: asRecentKimpay(data),
                    status: "found" as const,
                }))
                .catch((err) => {
                    if (err.status === 0)
                        return { id, status: "network_error" as const };
                    if (err.status === 404 || err.status === 403)
                        return { id, status: "missing" as const };
                    return { id, status: "error" as const };
                })
        );

        const results = await Promise.all(promises);

        // Server unreachable: keep the cached list as-is (the request
        // interceptor has switched to offline mode, see offlineStore).
        if (results.some((r) => r.status === "network_error")) return false;

        const fetchedItems = results
            .filter(
                (r): r is { id: string; data: RecentKimpay; status: "found" } =>
                    r.status === "found"
            )
            .map((r) => r.data);

        // Merge fetched data with the list. A Kimpay may not be listed yet:
        // right after creating/joining one, its local entry only holds the
        // identity until the group page has cached its data.
        for (const item of fetchedItems) {
            this.addRecentKimpay(item);
        }

        // Remove missing items, except groups created offline that the
        // server does not know yet (their creation is still queued).
        const queuedIds = new Set(
            (await storageService.getPendingActions())
                .filter((a) => a.type === "CREATE_KIMPAY")
                .map((a) => a.kimpayId)
        );
        const missingIds = results
            .filter((r) => r.status === "missing" && !queuedIds.has(r.id))
            .map((r) => r.id);

        missingIds.forEach((id) => {
            storageService.removeRecentKimpay(id);
            this.removeRecentKimpay(id);
        });
        return true;
    }

    private subscribeToKimpays() {
        this.recentKimpays.forEach((item) => this.subscribeTo(item.id));
    }

    /** Realtime subscriptions by Kimpay id (at most one per Kimpay). */
    private subscriptions = new Map<string, Promise<(() => void) | null>>();

    private subscribeTo(id: string) {
        if (this.subscriptions.has(id)) return;
        this.subscriptions.set(
            id,
            pb
                .collection("kimpays")
                .subscribe(id, (e) => {
                    if (e.action === "update") {
                        this.updateRecentKimpay(asRecentKimpay(e.record));
                    } else if (e.action === "delete") {
                        this.removeRecentKimpay(e.record.id);
                    }
                })
                .catch((err) => {
                    console.warn("Failed to subscribe to", id, err);
                    this.subscriptions.delete(id);
                    return null;
                }),
        );
    }

    private unsubscribeFrom(id: string) {
        const unsubscribe = this.subscriptions.get(id);
        if (!unsubscribe) return;
        this.subscriptions.delete(id);
        unsubscribe.then((fn) => fn?.());
    }

    private async loadFromCache(ids: string[]) {
        const offlineItems: RecentKimpay[] = [];
        for (const id of ids) {
            const cached = await storageService.getKimpayData(id);
            if (cached && cached.name) {
                const item: RecentKimpay = {
                    id: cached.id,
                    name: cached.name,
                    created_by: cached.created_by,
                };
                if (cached.icon) item.icon = cached.icon;
                offlineItems.push(item);
            }
        }
        this.recentKimpays = offlineItems;
    }

    /** Forget a Kimpay on this device (list and local cache). */
    async forget(id: string) {
        this.removeRecentKimpay(id);
        await storageService.removeRecentKimpay(id);
    }

    removeRecentKimpay(id: string) {
        this.recentKimpays = this.recentKimpays.filter((k) => k.id !== id);
        this.unsubscribeFrom(id);
    }

    addRecentKimpay(kimpay: RecentKimpay) {
        if (!kimpay || !kimpay.id) return;
        if (!this.recentKimpays.find((k) => k.id === kimpay.id)) {
            this.recentKimpays = [kimpay, ...this.recentKimpays];
            if (!offlineStore.isOffline) this.subscribeTo(kimpay.id);
        } else {
            this.updateRecentKimpay(kimpay);
        }
    }

    updateRecentKimpay(kimpay: RecentKimpay) {
        if (!kimpay || !kimpay.id) return;
        this.recentKimpays = this.recentKimpays.map((k) =>
            k.id === kimpay.id ? { ...k, ...kimpay } : k
        );
    }
}

export const recentsStore = new RecentsStore();
