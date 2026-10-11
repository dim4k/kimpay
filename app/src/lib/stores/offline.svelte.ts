import { pb } from "#lib/pocketbase.js";
import { storageService, type PendingAction } from "#lib/services/storage.js";
import { objectToFormData } from "#lib/utils/formData.js";
import { isNetworkError } from "#lib/utils/errors.js";

class OfflineStore {
    isOffline = $state(false);
    isSyncing = $state(false);

    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private syncedListeners = new Set<() => void>();

    constructor() {
        if (typeof window !== "undefined") {
            this.setOffline(!navigator.onLine);
            window.addEventListener("online", () => this.setOffline(false));
            window.addEventListener("offline", () => this.setOffline(true));

            // Global Network Error Interceptor
            const originalSend = pb.send;
            pb.send = async <T = unknown>(
                path: string,
                options: Record<string, unknown>,
            ): Promise<T> => {
                try {
                    const result = await originalSend.call(pb, path, options);
                    if (this.isOffline && path !== "/api/health") {
                        this.setOffline(false);
                    }
                    return result as T;
                } catch (e: unknown) {
                    // Only a genuine connectivity loss switches to offline mode
                    // (not a cancelled request, nor a server-side error).
                    if (isNetworkError(e) && !navigator.onLine) {
                        this.setOffline(true);
                    }
                    throw e;
                }
            };
        }
    }

    setOffline(status: boolean) {
        if (this.isOffline === status) return;
        this.isOffline = status;

        if (status) {
            this.startHealthCheck();
        } else {
            this.stopHealthCheck();
            this.processPendingQueue();
        }
    }

    /**
     * Called once the app is back online and the offline queue has been
     * replayed, so views can refresh. Returns an unsubscribe function.
     */
    onSynced(callback: () => void) {
        this.syncedListeners.add(callback);
        return () => this.syncedListeners.delete(callback);
    }

    private startHealthCheck() {
        if (this.healthCheckInterval) return;
        this.healthCheckInterval = setInterval(async () => {
            try {
                const health = await pb.health.check({ requestKey: null });
                if (health.code === 200) {
                    this.setOffline(false);
                }
            } catch (_) {
                // Still offline
            }
        }, 3000);
    }

    private stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Queue a write to replay when back online. `id` is the action id; for
     * creations it is the (client-generated) id of the record to create.
     */
    async queueAction(
        type: PendingAction["type"],
        payload: Record<string, unknown>,
        kimpayId: string,
        id?: string,
    ) {
        const actionId =
            id || `action_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        await storageService.savePendingAction({
            id: actionId,
            type,
            payload,
            timestamp: Date.now(),
            kimpayId,
        });
        return actionId;
    }

    async processPendingQueue() {
        if (this.isSyncing || this.isOffline) return;
        this.isSyncing = true;

        // Legacy queues may still reference "temp_" ids created before ids
        // were generated client-side: map them to the real ids as we go.
        const idMapping: Record<string, string> = {};
        const mapId = (id: unknown) =>
            typeof id === "string" && id in idMapping ? idMapping[id] : id;

        try {
            const queue = await storageService.getPendingActions();
            for (const action of queue) {
                try {
                    const payload = { ...action.payload };
                    payload.payer = mapId(payload.payer);
                    payload.created_by = mapId(payload.created_by);
                    if (Array.isArray(payload.involved)) {
                        payload.involved = payload.involved.map(mapId);
                    }
                    const targetId = mapId(payload.id) as string;

                    if (action.type === "CREATE_PARTICIPANT") {
                        const record = await pb
                            .collection("participants")
                            .create(payload);
                        idMapping[action.id] = record.id;
                    } else if (action.type === "CREATE_EXPENSE") {
                        const formData = new FormData();
                        if (!action.id.startsWith("temp_")) {
                            formData.append("id", action.id);
                        }
                        objectToFormData(payload, formData);
                        const record = await pb
                            .collection("expenses")
                            .create(formData);
                        idMapping[action.id] = record.id;
                    } else if (action.type === "DELETE_EXPENSE") {
                        await pb.collection("expenses").delete(targetId);
                    } else if (action.type === "UPDATE_EXPENSE") {
                        const {
                            id: _id,
                            newPhotos: _newPhotos,
                            deletedPhotos,
                            ...updateData
                        } = payload;
                        const formData = objectToFormData(updateData);
                        if (Array.isArray(deletedPhotos)) {
                            deletedPhotos.forEach((photo: string) => {
                                formData.append("photos-", photo);
                            });
                        }
                        await pb
                            .collection("expenses")
                            .update(targetId, formData);
                    } else if (action.type === "DELETE_PARTICIPANT") {
                        await pb.collection("participants").delete(targetId);
                    } else if (action.type === "CREATE_KIMPAY") {
                        await pb.collection("kimpays").create(payload);
                    } else if (action.type === "UPDATE_KIMPAY") {
                        await pb
                            .collection("kimpays")
                            .update(action.kimpayId, payload);
                    } else if (action.type === "DELETE_KIMPAY") {
                        await pb.collection("kimpays").delete(action.kimpayId);
                    }

                    await storageService.removePendingAction(action.id);
                } catch (e) {
                    if (isNetworkError(e)) {
                        // Connection lost again: keep this and the following
                        // actions, in order, for the next attempt.
                        break;
                    }
                    const status = (e as { status?: number }).status ?? 0;
                    if (status >= 400 && status < 500) {
                        // Rejected for good (deleted meanwhile, invalid...):
                        // retrying would fail forever and block nothing else.
                        console.error("Dropping rejected offline action", action, e);
                        await storageService.removePendingAction(action.id);
                    } else {
                        console.error("Failed to sync action", action.id, e);
                    }
                }
            }
        } finally {
            this.isSyncing = false;
            this.syncedListeners.forEach((listener) => listener());
        }
    }

    async withOfflineSupport<T>(
        runOnline: () => Promise<T>,
        onOffline: () => T | Promise<T>,
    ): Promise<T> {
        if (!this.isOffline) {
            try {
                return await runOnline();
            } catch (e: unknown) {
                if (isNetworkError(e) && !navigator.onLine) {
                    this.setOffline(true);
                } else {
                    throw e;
                }
            }
        }
        return await onOffline();
    }
}

export const offlineStore = new OfflineStore();
