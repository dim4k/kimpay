import { get } from "svelte/store";
import { pb } from "#lib/pocketbase.js";
import { storageService, type PendingAction } from "#lib/services/storage.js";
import { objectToFormData } from "#lib/utils/formData.js";
import { isNetworkError } from "#lib/utils/errors.js";
import { isKimpayId } from "#lib/utils/id.js";
import { t } from "#lib/i18n.js";
import { toasts } from "#lib/stores/toasts.svelte.js";

/** Returned by `write` when the change was queued instead of sent. */
export const QUEUED = Symbol("queued");

/** How to replay a write that cannot be sent now (see `queueAction`). */
export interface QueuedWrite {
    type: PendingAction["type"];
    payload: Record<string, unknown>;
    kimpayId: string;
    id?: string;
}

// A replay failing on a server error is retried later, this many times at most.
const MAX_ATTEMPTS = 5;
const RETRY_DELAY = 30_000;
// A write still unanswered after this long (weak signal) is treated as sent
// without network: queued, or kept queued.
const WRITE_TIMEOUT = 15_000;
// Cross-tab lock: a single tab (or PWA window) replays the shared queue at a time.
const QUEUE_LOCK = "kimpay-offline-queue";

// Collection of the record each creation makes (to check it already exists).
const CREATED_IN: Partial<Record<PendingAction["type"], string>> = {
    CREATE_EXPENSE: "expenses",
    CREATE_PARTICIPANT: "participants",
    CREATE_KIMPAY: "kimpays",
};

/** Same shape as a PocketBase network error (see isNetworkError). */
const offlineError = () => Object.assign(new Error("Offline"), { status: 0 });

/**
 * Fails like a network error when `request` takes too long. The request is
 * not cancelled and may still go through: replaying it is safe (see
 * `alreadyApplied`).
 */
function withTimeout<T>(request: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(offlineError()), WRITE_TIMEOUT);
    });
    return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

/** Server errors worth retrying (overloaded, restarting, rate limited...). */
const isTransient = (status: number | undefined) =>
    status === undefined || status === 0 || status === 408 || status === 429 || status >= 500;

type Outcome = "done" | "rejected" | "wait";

class OfflineStore {
    isOffline = $state(false);
    isSyncing = $state(false);

    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private syncRun: Promise<boolean> | null = null;
    // The queue was found empty by the last replay, and nothing was queued
    // here since: writes are then sent at once, without first reading the
    // queue (a page closed right after a change would otherwise lose the
    // request before it leaves).
    private queueEmpty = false;
    private syncedListeners = new Set<(rejected: PendingAction[]) => void>();

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
                    // A request that never reached the server switches to
                    // offline mode, even when the browser claims to be online
                    // (weak signal, captive portal, server down): the health
                    // check switches back. Not a cancelled request, nor a
                    // server-side error (see isNetworkError).
                    if (isNetworkError(e)) {
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
            // Views refresh once the queue has been replayed (and even when
            // it was empty: changes made elsewhere meanwhile).
            this.processPendingQueue().then(() => this.notifySynced([]));
        }
    }

    /**
     * Called once the app is back online, and whenever queued writes have
     * been replayed (with those the server rejected), so views can refresh.
     * Returns an unsubscribe function.
     */
    onSynced(callback: (rejected: PendingAction[]) => void) {
        this.syncedListeners.add(callback);
        return () => this.syncedListeners.delete(callback);
    }

    private notifySynced(rejected: PendingAction[]) {
        this.syncedListeners.forEach((listener) => listener(rejected));
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
     * Perform a write online, or queue it to replay later: when offline, when
     * earlier writes are still queued (they go first, in order), or when the
     * request fails for lack of network or takes too long. Returns the online
     * result, or QUEUED. Without `queued` (e.g. a write with photos, which are
     * not stored and may take long to upload), it fails with a network error
     * instead, and is never timed out.
     */
    async write<T>(
        runOnline: () => Promise<T>,
        queued: QueuedWrite | null,
    ): Promise<T | typeof QUEUED> {
        const ready =
            !this.isOffline && this.queueEmpty && !this.syncRun
                ? true
                : await this.processPendingQueue();
        if (ready) {
            try {
                return await (queued ? withTimeout(runOnline()) : runOnline());
            } catch (e) {
                // The request may have reached the server (only the response
                // was lost): replaying it is safe, see `alreadyApplied`.
                if (!queued || !isNetworkError(e)) throw e;
                // Also on a timeout: the health check tells when it is back.
                this.setOffline(true);
            }
        } else if (!queued) {
            throw offlineError();
        }
        await this.queueAction(queued);
        return QUEUED;
    }

    /**
     * Queue a write to replay when back online. `id` is the action id; for
     * creations it is the (client-generated) id of the record to create.
     */
    private async queueAction({ type, payload, kimpayId, id }: QueuedWrite) {
        this.queueEmpty = false;
        await storageService.savePendingAction({
            id: id || `action_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            type,
            // IndexedDB cannot clone Svelte proxies.
            payload: $state.snapshot(payload),
            timestamp: Date.now(),
            kimpayId,
        });
    }

    /**
     * Replay the queued writes, in order. Resolves to true once the queue is
     * empty, false when it has to wait (offline, or a server error to retry
     * later). Concurrent calls share the same run.
     */
    processPendingQueue(): Promise<boolean> {
        if (this.isOffline) return Promise.resolve(false);
        this.syncRun ??= this.exclusive(() => this.replayQueue()).finally(() => {
            this.syncRun = null;
        });
        return this.syncRun;
    }

    /** Run `fn` holding the cross-tab queue lock (when the browser has one). */
    private exclusive<T>(fn: () => Promise<T>): Promise<T> {
        if (typeof navigator === "undefined" || !navigator.locks) return fn();
        return navigator.locks.request(QUEUE_LOCK, fn);
    }

    private async replayQueue(): Promise<boolean> {
        this.isSyncing = true;
        const rejected: PendingAction[] = [];
        // Legacy queues may still reference "temp_" ids created before ids
        // were generated client-side: map them to the real ids as we go.
        const idMapping: Record<string, string> = {};
        // Each action is handled once per run, even if its removal failed.
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local bookkeeping
        const handled = new Set<string>();
        let empty = false;

        try {
            // The head is read again each time: other tabs may queue meanwhile.
            while (!this.isOffline) {
                const [action] = await storageService.getPendingActions();
                if (!action) {
                    empty = true;
                    break;
                }
                if (handled.has(action.id)) break;
                if (action.retryAt && action.retryAt > Date.now()) {
                    this.scheduleRetry(action.retryAt - Date.now());
                    break;
                }
                handled.add(action.id);

                const outcome = await this.replay(action, idMapping);
                if (outcome === "wait") break;
                if (outcome === "rejected") rejected.push(action);
                await storageService.removePendingAction(action.id);
            }
        } finally {
            this.isSyncing = false;
            if (rejected.length > 0) {
                toasts.error(
                    get(t)("toast.offline_rejected", { count: String(rejected.length) }),
                    8000,
                );
            }
            if (handled.size > 0) this.notifySynced(rejected);
        }
        this.queueEmpty = empty;
        return empty;
    }

    private async replay(
        action: PendingAction,
        idMapping: Record<string, string>,
    ): Promise<Outcome> {
        try {
            await withTimeout(this.send(action, idMapping));
            return "done";
        } catch (e) {
            // Offline again (or no answer): keep this and the following
            // actions, in order, for the next attempt.
            if (isNetworkError(e)) {
                this.setOffline(true);
                return "wait";
            }

            const status = (e as { status?: number }).status;
            if (await this.alreadyApplied(action, status)) return "done";
            if (this.isOffline) return "wait";

            const attempts = (action.attempts ?? 0) + 1;
            if (isTransient(status) && attempts < MAX_ATTEMPTS) {
                // Blocks the queue (order matters) until the retry.
                console.warn("Offline action failed, retrying later", action.id, e);
                await storageService.updatePendingAction(action.id, {
                    attempts,
                    retryAt: Date.now() + RETRY_DELAY,
                });
                this.scheduleRetry(RETRY_DELAY);
                return "wait";
            }
            // Rejected for good (deleted meanwhile, invalid...): retrying
            // would fail forever and block the queue.
            console.error("Dropping rejected offline action", action, e);
            return "rejected";
        }
    }

    private async send(action: PendingAction, idMapping: Record<string, string>) {
        const mapId = (id: unknown) =>
            typeof id === "string" && id in idMapping ? idMapping[id] : id;
        const payload = { ...action.payload };
        payload.payer = mapId(payload.payer);
        payload.created_by = mapId(payload.created_by);
        if (Array.isArray(payload.involved)) {
            payload.involved = payload.involved.map(mapId);
        }
        const targetId = mapId(payload.id) as string;
        // No auto-cancellation: an aborted replay would look like a failure.
        const options = { requestKey: null };

        if (action.type === "CREATE_PARTICIPANT") {
            // Linked to the account logged in when queued: unlinked if that
            // session is gone (expired, logged out), which the server would
            // reject. It can be claimed again after logging in.
            if (
                payload.user &&
                (!pb.authStore.isValid || payload.user !== pb.authStore.record?.id)
            ) {
                delete payload.user;
            }
            const record = await pb.collection("participants").create(payload, options);
            idMapping[action.id] = record.id;
        } else if (action.type === "CREATE_EXPENSE") {
            const formData = new FormData();
            if (!action.id.startsWith("temp_")) {
                formData.append("id", action.id);
            }
            objectToFormData(payload, formData);
            const record = await pb.collection("expenses").create(formData, options);
            idMapping[action.id] = record.id;
        } else if (action.type === "DELETE_EXPENSE") {
            await pb.collection("expenses").delete(targetId, options);
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
            await pb.collection("expenses").update(targetId, formData, options);
        } else if (action.type === "DELETE_PARTICIPANT") {
            await pb.collection("participants").delete(targetId, options);
        } else if (action.type === "UPDATE_PARTICIPANT") {
            const { id: _id, ...updateData } = payload;
            await pb.collection("participants").update(targetId, updateData, options);
        } else if (action.type === "CREATE_KIMPAY") {
            if (payload.creator) {
                await pb.send("/api/kimpay/create", { method: "POST", body: payload, ...options });
            } else {
                // Legacy queue: participants and created_by follow as actions.
                await pb.collection("kimpays").create(payload, options);
            }
        } else if (action.type === "UPDATE_KIMPAY") {
            await pb.collection("kimpays").update(action.kimpayId, payload, options);
        } else if (action.type === "DELETE_KIMPAY") {
            await pb.collection("kimpays").delete(action.kimpayId, options);
        }
    }

    /**
     * Whether a replay failed because the write was already applied: its
     * first try reached the server, only the response was lost.
     */
    private async alreadyApplied(action: PendingAction, status: number | undefined) {
        if (action.type.startsWith("DELETE_")) return status === 404;

        const collection = CREATED_IN[action.type];
        // Creations with a client-generated id only (record id format).
        if (!collection || status !== 400 || !isKimpayId(action.id)) return false;
        try {
            await pb.collection(collection).getOne(action.id, { fields: "id", requestKey: null });
            return true;
        } catch {
            return false;
        }
    }

    private scheduleRetry(delay: number) {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.processPendingQueue();
        }, delay);
    }
}

export const offlineStore = new OfflineStore();
