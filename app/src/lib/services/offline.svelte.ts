import { pb } from "$lib/pocketbase";
import { storageService, type PendingAction } from "$lib/services/storage";

class OfflineService {
    isOffline = $state(false);
    isSyncing = $state(false);

    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private onOnlineCallback: (() => void) | null = null;

    constructor() {
        if (typeof window !== "undefined") {
            this.setOffline(!navigator.onLine);
            window.addEventListener("online", () => this.setOffline(false));
            window.addEventListener("offline", () => this.setOffline(true));

            // Global Network Error Interceptor
            const originalSend = pb.send;
            pb.send = async <T = unknown>(path: string, options: Record<string, unknown>): Promise<T> => {
                try {
                    const result = await originalSend.call(pb, path, options);
                    if (this.isOffline && path !== '/api/health') {
                        this.setOffline(false);
                    }
                    return result as T;
                } catch (e: unknown) {
                    if ((e as { status?: number })?.status === 0) {
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
            // Trigger callback to refresh data
            this.onOnlineCallback?.();
        }
    }

    registerListener(callback: () => void) {
        this.onOnlineCallback = callback;
    }

    private startHealthCheck() {
        if (this.healthCheckInterval) return;
        this.healthCheckInterval = setInterval(async () => {
             try {
                 const health = await pb.health.check();
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

    queueAction(type: PendingAction['type'], payload: Record<string, unknown>, kimpayId: string, id?: string) {
        const actionId = id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        storageService.savePendingAction({
            id: actionId,
            type,
            payload,
            timestamp: Date.now(),
            kimpayId
        });
        return actionId;
    }

    async processPendingQueue() {
        if (this.isSyncing || this.isOffline) return;
        
        const queue = storageService.getPendingActions();
        if (queue.length === 0) return;

        this.isSyncing = true;
        const idMapping: Record<string, string> = {}; // TempID -> RealID
        console.log(`Syncing ${queue.length} offline actions...`);

        try {
            for (const action of queue) {
                try {
                    // Clone payload to allow modification
                    const payload = { ...action.payload };
                    
                    // Replace Payer Dependency
                    if (typeof payload.payer === 'string' && payload.payer in idMapping) {
                        payload.payer = idMapping[payload.payer];
                    }
                    
                    // Replace Involved Dependency
                    if (Array.isArray(payload.involved)) {
                        payload.involved = payload.involved.map((id: string) => idMapping[id] || id);
                    }
                    
                    // Replace "created_by" Dependency
                    if (typeof payload.created_by === 'string' && payload.created_by in idMapping) {
                        payload.created_by = idMapping[payload.created_by];
                    }

                    if (action.type === 'CREATE_PARTICIPANT') {
                         const record = await pb.collection('participants').create(payload);
                         idMapping[action.id] = record.id;
                    }
                    else if (action.type === 'CREATE_EXPENSE') {
                        // Reconstruct FormData for expense
                        const formData = new FormData();
                        
                        // Use the action ID as the record ID if it's not a temp-timestamp
                        if (!action.id.startsWith('temp_')) {
                            formData.append('id', action.id);
                        }

                        Object.entries(payload).forEach(([key, value]) => {
                             if (Array.isArray(value)) {
                                 value.forEach(v => formData.append(key, v as string));
                             } else {
                                 formData.append(key, value as string);
                             }
                        });

                        const record = await pb.collection('expenses').create(formData);
                        idMapping[action.id] = record.id;
                    } 
                    else if (action.type === 'DELETE_EXPENSE') {
                         await pb.collection("expenses").delete(action.payload.id as string);
                    }
                    else if (action.type === 'CREATE_KIMPAY') {
                        await pb.collection('kimpays').create(payload);
                    }
                    else if (action.type === 'UPDATE_KIMPAY') {
                        // Use kimpayId from action if payload doesn't have ID, or payload might have it?
                        // kimpayStore.updateDetails queues {name, icon}
                        await pb.collection('kimpays').update(action.kimpayId, payload);
                    }
                    else if (action.type === 'DELETE_KIMPAY') {
                        await pb.collection('kimpays').delete(action.kimpayId);
                    }
                    
                    storageService.removePendingAction(action.id);
                } catch (e) {
                    console.error("Failed to sync action", action.id, e);
                }
            }
        } finally {
            this.isSyncing = false;
            // Trigger refresh after sync
            this.onOnlineCallback?.();
        }
    }
    async withOfflineSupport<T>(
        runOnline: () => Promise<T>,
        onOffline: () => T | Promise<T>
    ): Promise<T> {
        if (!this.isOffline) {
            try {
                return await runOnline();
            } catch (e: unknown) {
                if ((e as { status?: number })?.status === 0) {
                    this.setOffline(true);
                } else {
                    throw e;
                }
            }
        }
        return await onOffline();
    }
}

export const offlineService = new OfflineService();
