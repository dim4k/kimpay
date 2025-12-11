import { pb } from "$lib/pocketbase";
import type { RecentKimpay } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte";

class RecentsService {
    recentKimpays: RecentKimpay[] = $state([]);
    loading = $state(false);
    initialized = $state(false);

    async init() {
        if (this.initialized || this.loading) return;

        try {
            this.loading = true;
            const ids = storageService.getRecentKimpayIds();

            if (ids.length === 0) {
                this.recentKimpays = [];
                this.initialized = true;
                return;
            }

            // Offline First Strategy
            if (offlineService.isOffline) {
                this.loadFromCache(ids);
                this.initialized = true;
                return;
            }

            const promises = ids.map((id) =>
                pb
                    .collection("kimpays")
                    .getOne(id, { requestKey: null })
                    .then((data) => ({
                        id,
                        data: data as unknown as RecentKimpay,
                        status: "found" as const,
                    }))
                    .catch((err) => {
                        if (err.status === 0) return { id, status: "network_error" as const };
                        if (err.status === 404 || err.status === 403)
                            return { id, status: "missing" as const };
                        return { id, status: "error" as const };
                    })
            );

            const results = await Promise.all(promises);

            if (results.some(r => r.status === 'network_error')) {
                 offlineService.setOffline(true);
                 this.loadFromCache(ids);
                 this.initialized = true;
                 return;
            }

            const fetchedItems = results
                .filter((r): r is { id: string; data: RecentKimpay; status: "found" } => r.status === "found")
                .map((r) => r.data);

            const missingIds = results
                .filter((r) => r.status === "missing")
                .map((r) => r.id);

            if (missingIds.length > 0) {
                missingIds.forEach((id) => {
                    storageService.removeRecentKimpay(id);
                });
            }

            this.recentKimpays = fetchedItems;
            this.initialized = true;

            // Subscribe to each item
            this.recentKimpays.forEach((item) => {
                pb.collection("kimpays")
                    .subscribe(item.id, (e) => {
                        if (e.action === "update") {
                            this.updateRecentKimpay(e.record as unknown as RecentKimpay);
                        } else if (e.action === "delete") {
                            this.removeRecentKimpay(e.record.id);
                        }
                    })
                    .catch((err) => console.warn("Failed to subscribe to", item.id, err));
            });
        } catch (e) {
            console.error("Failed to load recent kimpays", e);
        } finally {
            this.loading = false;
        }
    }

    private loadFromCache(ids: string[]) {
        const offlineItems: RecentKimpay[] = [];
        for (const id of ids) {
            const cached = storageService.getKimpayData(id);
            if (cached) {
                const item: RecentKimpay = {
                    id: cached.id,
                    name: cached.name,
                    created_by: cached.created_by
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
                                this.updateRecentKimpay(e.record as unknown as RecentKimpay);
                            } else if (e.action === "delete") {
                                this.removeRecentKimpay(e.record.id);
                            }
                        })
                        .catch(() => {});
                } catch { /* ignore */ }
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
