import type { Kimpay } from "$lib/types";
import { get, set, del, keys } from "idb-keyval";

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

// Legacy key for migration (will be removed after migration)
const LEGACY_MY_KIMPAYS_KEY = "my_kimpays";

export const storageService = {
    // --- Migration ---
    migrate: async (): Promise<boolean> => {
        if (typeof localStorage === "undefined") return false;

        // Check for legacy data in localStorage
        const hasLegacyMyKimpays = localStorage.getItem(LEGACY_MY_KIMPAYS_KEY);
        const hasQueue = localStorage.getItem(QUEUE_KEY);

        let hasKimpayData = false;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(STORAGE_PREFIX)) {
                hasKimpayData = true;
                break;
            }
        }

        // Also check IndexedDB for legacy my_kimpays key
        const hasLegacyIndexedDB = await get<Record<string, string>>(LEGACY_MY_KIMPAYS_KEY);

        if (!hasLegacyMyKimpays && !hasQueue && !hasKimpayData && !hasLegacyIndexedDB) return false;

        console.log("Migrating storage...");

        try {
            // 1. Migrate localStorage to IndexedDB (if any)
            if (hasQueue) {
                await set(QUEUE_KEY, JSON.parse(hasQueue));
                localStorage.removeItem(QUEUE_KEY);
            }

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

            // 2. Migrate legacy my_kimpays mapping into kimpay objects
            let legacyMap: Record<string, string> = {};
            
            if (hasLegacyMyKimpays) {
                legacyMap = JSON.parse(hasLegacyMyKimpays);
                localStorage.removeItem(LEGACY_MY_KIMPAYS_KEY);
            } else if (hasLegacyIndexedDB) {
                legacyMap = hasLegacyIndexedDB;
            }

            // Merge participantIds into existing kimpay data
            for (const [kimpayId, participantId] of Object.entries(legacyMap)) {
                if (!kimpayId || !/^[a-zA-Z0-9]{15}$/.test(kimpayId)) continue;
                
                const existing = await get<Kimpay>(`${STORAGE_PREFIX}${kimpayId}`);
                if (existing) {
                    existing.myParticipantId = participantId;
                    await set(`${STORAGE_PREFIX}${kimpayId}`, existing);
                } else {
                    // Create minimal entry for kimpays we don't have cached
                    // They will be fetched properly when visited
                    const minimalKimpay: Partial<Kimpay> = {
                        id: kimpayId,
                        myParticipantId: participantId,
                    };
                    await set(`${STORAGE_PREFIX}${kimpayId}`, minimalKimpay);
                }
            }

            // Remove legacy key from IndexedDB
            await del(LEGACY_MY_KIMPAYS_KEY);

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
            // Preserve myParticipantId if it exists in the current cached version
            const existing = await get<Kimpay>(`${STORAGE_PREFIX}${id}`);
            if (existing?.myParticipantId && !data.myParticipantId) {
                data.myParticipantId = existing.myParticipantId;
            }
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

    // --- User Identity & My Kimpays List ---

    /** Get all Kimpay IDs stored locally */
    getRecentKimpayIds: async (): Promise<string[]> => {
        try {
            const allKeys = await keys();
            return allKeys
                .filter((key): key is string => 
                    typeof key === "string" && key.startsWith(STORAGE_PREFIX)
                )
                .map((key) => key.replace(STORAGE_PREFIX, ""))
                .filter((id) => id && /^[a-zA-Z0-9]{15}$/.test(id));
        } catch (_e) {
            return [];
        }
    },

    /** Get the current user's participant ID for a Kimpay */
    getMyParticipantId: async (kimpayId: string): Promise<string | null> => {
        try {
            const kimpay = await get<Kimpay>(`${STORAGE_PREFIX}${kimpayId}`);
            return kimpay?.myParticipantId || null;
        } catch (_e) {
            return null;
        }
    },

    /** Set the current user's participant ID for a Kimpay */
    setMyParticipantId: async (kimpayId: string, participantId: string) => {
        try {
            let kimpay = await get<Kimpay>(`${STORAGE_PREFIX}${kimpayId}`);
            if (kimpay) {
                kimpay.myParticipantId = participantId;
            } else {
                // Create minimal entry - will be populated when visiting the kimpay
                kimpay = { id: kimpayId, myParticipantId: participantId } as Kimpay;
            }
            await set(`${STORAGE_PREFIX}${kimpayId}`, kimpay);
        } catch (e) {
            console.error("Failed to save identity", e);
        }
    },

    /** Remove a Kimpay from local storage (used when leaving a group) */
    removeRecentKimpay: async (kimpayId: string) => {
        try {
            await del(`${STORAGE_PREFIX}${kimpayId}`);
        } catch (e) {
            console.error("Failed to remove kimpay", e);
        }
    },

    // --- Action Queue (Offline Ops) ---

    savePendingAction: async (action: PendingAction) => {
        try {
            console.log("[OfflineQueue] Saving action:", action.type, action.id);
            const queue = await storageService.getPendingActions();
            console.log("[OfflineQueue] Current queue length:", queue.length);
            queue.push(action);
            await set(QUEUE_KEY, queue);
            console.log("[OfflineQueue] Action saved successfully, new queue length:", queue.length);
        } catch (e) {
            console.error("[OfflineQueue] Failed to save pending action:", e);
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
