import { pb } from "$lib/pocketbase";
import type { RecentKimpay, Participant } from "$lib/types";
import { asRecentKimpay } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte";
import { auth } from "$lib/stores/auth.svelte";

class RecentsService {
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
            if (offlineService.isOffline) {
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

        if (results.some((r) => r.status === "network_error")) {
            offlineService.setOffline(true);
            return;
        }

        // Update existing items with fresh data
        const fetchedItems = results
            .filter(
                (r): r is { id: string; data: RecentKimpay; status: "found" } =>
                    r.status === "found"
            )
            .map((r) => r.data);

        // Merge fetched data with existing list
        for (const item of fetchedItems) {
            this.updateRecentKimpay(item);
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
        this.recentKimpays.forEach((item) => {
            pb.collection("kimpays")
                .subscribe(item.id, (e) => {
                    if (e.action === "update") {
                        this.updateRecentKimpay(asRecentKimpay(e.record));
                    } else if (e.action === "delete") {
                        this.removeRecentKimpay(e.record.id);
                    }
                })
                .catch((err) =>
                    console.warn("Failed to subscribe to", item.id, err)
                );
        });
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
    }

    addRecentKimpay(kimpay: RecentKimpay) {
        if (!kimpay || !kimpay.id) return;
        if (!this.recentKimpays.find((k) => k.id === kimpay.id)) {
            this.recentKimpays = [kimpay, ...this.recentKimpays];

            // Subscribe if possible
            if (!offlineService.isOffline) {
                try {
                    pb.collection("kimpays")
                        .subscribe(kimpay.id, (e) => {
                            if (e.action === "update") {
                                this.updateRecentKimpay(
                                    asRecentKimpay(e.record)
                                );
                            } else if (e.action === "delete") {
                                this.removeRecentKimpay(e.record.id);
                            }
                        })
                        .catch(() => {});
                } catch {
                    /* ignore */
                }
            }
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

export const recentsService = new RecentsService();
