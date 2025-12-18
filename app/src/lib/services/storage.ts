import type { Kimpay } from "$lib/types";
import { get, set, del } from "idb-keyval";

export interface PendingAction {
    id: string; // Unique ID for the action itself
    type:
        | "CREATE_EXPENSE"
        | "UPDATE_EXPENSE"
        | "CREATE_PARTICIPANT"
        | "DELETE_PARTICIPANT"
        | "DELETE_EXPENSE"
        | "UPDATE_KIMPAY"
        | "DELETE_KIMPAY"
        | "UPDATE_PARTICIPANT"
        | "CREATE_KIMPAY";
    payload: Record<string, unknown>; // The data needed to perform the action (e.g. FormData as object)
    timestamp: number;
    kimpayId: string;
}

const STORAGE_PREFIX = "kimpay_data_";
const QUEUE_KEY = "kimpay_offline_queue";

const MY_KIMPAYS_KEY = "my_kimpays";

export const storageService = {
    // --- Migration ---
    migrate: async (): Promise<boolean> => {
        if (typeof localStorage === "undefined") return false;

        // Check if we have legacy data
        const hasMyKimpays = localStorage.getItem(MY_KIMPAYS_KEY);
        const hasQueue = localStorage.getItem(QUEUE_KEY);

        // Quick check for any kimpay data
        let hasKimpayData = false;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(STORAGE_PREFIX)) {
                hasKimpayData = true;
                break;
            }
        }

        if (!hasMyKimpays && !hasQueue && !hasKimpayData) return false;

        console.log("Migrating from localStorage to IndexedDB...");

        try {
            // 1. Migrate My Kimpays (Identity map)
            if (hasMyKimpays) {
                await set(MY_KIMPAYS_KEY, JSON.parse(hasMyKimpays));
                localStorage.removeItem(MY_KIMPAYS_KEY);
            }

            // 2. Migrate Offline Queue
            if (hasQueue) {
                await set(QUEUE_KEY, JSON.parse(hasQueue));
                localStorage.removeItem(QUEUE_KEY);
            }

            // 3. Migrate Kimpay Data
            // We iterate backwards because we are removing items
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(STORAGE_PREFIX)) {
                    const val = localStorage.getItem(key);
                    if (val) {
                        await set(key, JSON.parse(val));
                        keysToRemove.push(key);
                    }
                }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));

            console.log("Migration complete.");
            return true;
        } catch (e) {
            console.error("Migration failed", e);
            return false;
        }
    },

    // --- Data Persistence (Consultation) ---

    saveKimpayData: async (id: string, data: Kimpay) => {
        try {
            await set(`${STORAGE_PREFIX}${id}`, data);
        } catch (e) {
            console.error("Failed to save to storage", e);
        }
    },

    getKimpayData: async (id: string): Promise<Kimpay | null> => {
        try {
            return (await get<Kimpay>(`${STORAGE_PREFIX}${id}`)) || null;
        } catch (e) {
            console.error("Failed to read from storage", e);
            return null;
        }
    },

    hasKimpayData: async (id: string): Promise<boolean> => {
        try {
            const val = await get(`${STORAGE_PREFIX}${id}`);
            return !!val;
        } catch {
            return false;
        }
    },

    // --- User Identity & Recents List ---

    getRecentKimpayIds: async (): Promise<string[]> => {
        try {
            const map =
                (await get<Record<string, string>>(MY_KIMPAYS_KEY)) || {};
            return Object.keys(map).filter(
                (id) => id && /^[a-zA-Z0-9]{15}$/.test(id)
            );
        } catch (_e) {
            return [];
        }
    },

    getMyParticipantId: async (kimpayId: string): Promise<string | null> => {
        try {
            const map =
                (await get<Record<string, string>>(MY_KIMPAYS_KEY)) || {};
            return map[kimpayId] || null;
        } catch (_e) {
            return null;
        }
    },

    setMyParticipantId: async (kimpayId: string, participantId: string) => {
        try {
            const map =
                (await get<Record<string, string>>(MY_KIMPAYS_KEY)) || {};
            map[kimpayId] = participantId;
            await set(MY_KIMPAYS_KEY, map);
        } catch (e) {
            console.error("Failed to save identity", e);
        }
    },

    removeRecentKimpay: async (kimpayId: string) => {
        try {
            const map =
                (await get<Record<string, string>>(MY_KIMPAYS_KEY)) || {};
            if (map[kimpayId]) {
                delete map[kimpayId];
                await set(MY_KIMPAYS_KEY, map);
            }
        } catch (e) {
            console.error("Failed to remove recent kimpay", e);
        }
    },

    // --- Action Queue (Offline Ops) ---

    savePendingAction: async (action: PendingAction) => {
        try {
            const queue = await storageService.getPendingActions();
            queue.push(action);
            await set(QUEUE_KEY, queue);
        } catch (e) {
            console.error("Failed to save pending action", e);
        }
    },

    getPendingActions: async (): Promise<PendingAction[]> => {
        try {
            return (await get<PendingAction[]>(QUEUE_KEY)) || [];
        } catch (_) {
            return [];
        }
    },

    removePendingAction: async (actionId: string) => {
        try {
            const queue = await storageService.getPendingActions();
            const newQueue = queue.filter((a) => a.id !== actionId);
            await set(QUEUE_KEY, newQueue);
        } catch (e) {
            console.error("Failed to remove pending action", e);
        }
    },

    clearQueue: async () => {
        await del(QUEUE_KEY);
    },
};
