import { pb } from "#lib/pocketbase.js";
import type { RecentKimpay, Participant } from "#lib/types.js";
import { asRecentKimpay } from "#lib/types.js";
import { storageService } from "#lib/services/storage.js";
import { offlineStore } from "#lib/stores/offline.svelte.js";
import { auth } from "#lib/stores/auth.svelte.js";

class RecentsStore {
    recentKimpays: RecentKimpay[] = $state([]);
    loading = $state(false);
    initialized = $state(false);

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
                this.initialized = true;
                return;
            }

            // 2. For logged-in users: also fetch Kimpays from their account
            if (auth.user) {
                await this.enrichWithAccountKimpays();
            }

            // 3. Validate and update local Kimpays with fresh data
            if (localIds.length > 0) {
                await this.validateAndUpdateFromServer(localIds);
            }

            this.initialized = true;

            // 4. Subscribe to realtime updates
            this.subscribeToKimpays();
        } catch (e) {
            console.error("Failed to load kimpays", e);
        } finally {
            this.loading = false;
        }
    }

    /** Fetch Kimpays linked to the user's PocketBase account and merge them */
    private async enrichWithAccountKimpays() {
        try {
            const records = await pb.collection('participants').getList<Participant>(1, 100, {
                filter: `user = "${auth.user!.id}"`,
                sort: '-created',
                expand: 'kimpay'
            });

            for (const participant of records.items) {
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
        } catch (e) {
            console.warn("Could not fetch account kimpays", e);
        }
    }

    /** Validate local Kimpays against server and update with fresh data */
    private async validateAndUpdateFromServer(ids: string[]) {
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

        // Server unreachable: keep the cached list as-is. Offline mode is only
        // entered on a real connectivity loss (see offlineStore), otherwise
        // writes would be queued while the browser is actually online.
        if (results.some((r) => r.status === "network_error")) {
            if (!navigator.onLine) offlineStore.setOffline(true);
            return;
        }

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

        // Remove missing items
        const missingIds = results
            .filter((r) => r.status === "missing")
            .map((r) => r.id);

        missingIds.forEach((id) => {
            storageService.removeRecentKimpay(id);
            this.removeRecentKimpay(id);
        });
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
