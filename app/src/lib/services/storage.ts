import type { Kimpay } from "$lib/types";

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
    // --- Data Persistence (Consultation) ---

    saveKimpayData: (id: string, data: Kimpay) => {
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem(
                `${STORAGE_PREFIX}${id}`,
                JSON.stringify(data)
            );
        } catch (e) {
            console.error("Failed to save to local storage", e);
        }
    },

    getKimpayData: (id: string): Kimpay | null => {
        if (typeof localStorage === "undefined") return null;
        try {
            const data = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error("Failed to read from local storage", e);
            return null;
        }
    },

    hasKimpayData: (id: string): boolean => {
        if (typeof localStorage === "undefined") return false;
        return !!localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    },

    // --- User Identity & Recents List ---

    getRecentKimpayIds: (): string[] => {
        if (typeof localStorage === "undefined") return [];
        try {
            const map = JSON.parse(
                localStorage.getItem(MY_KIMPAYS_KEY) || "{}"
            );
            return Object.keys(map).filter(
                (id) => id && /^[a-zA-Z0-9]{15}$/.test(id)
            );
        } catch (_e) {
            return [];
        }
    },

    getMyParticipantId: (kimpayId: string): string | null => {
        if (typeof localStorage === "undefined") return null;
        try {
            const map = JSON.parse(
                localStorage.getItem(MY_KIMPAYS_KEY) || "{}"
            );
            return map[kimpayId] || null;
        } catch (_e) {
            return null;
        }
    },

    setMyParticipantId: (kimpayId: string, participantId: string) => {
        if (typeof localStorage === "undefined") return;
        try {
            const map = JSON.parse(
                localStorage.getItem(MY_KIMPAYS_KEY) || "{}"
            );
            map[kimpayId] = participantId;
            localStorage.setItem(MY_KIMPAYS_KEY, JSON.stringify(map));
        } catch (e) {
            console.error("Failed to save identity", e);
        }
    },

    removeRecentKimpay: (kimpayId: string) => {
        if (typeof localStorage === "undefined") return;
        try {
            const map = JSON.parse(
                localStorage.getItem(MY_KIMPAYS_KEY) || "{}"
            );
            delete map[kimpayId];
            localStorage.setItem(MY_KIMPAYS_KEY, JSON.stringify(map));
        } catch (e) {
            console.error("Failed to remove recent kimpay", e);
        }
    },

    // --- Action Queue (Offline Ops) ---

    savePendingAction: (action: PendingAction) => {
        if (typeof localStorage === "undefined") return;
        try {
            const queue = storageService.getPendingActions();
            queue.push(action);
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            console.error("Failed to save pending action", e);
        }
    },

    getPendingActions: (): PendingAction[] => {
        if (typeof localStorage === "undefined") return [];
        try {
            const data = localStorage.getItem(QUEUE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (_) {
            return [];
        }
    },

    removePendingAction: (actionId: string) => {
        if (typeof localStorage === "undefined") return;
        try {
            const queue = storageService.getPendingActions();
            const newQueue = queue.filter((a) => a.id !== actionId);
            localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
        } catch (e) {
            console.error("Failed to remove pending action", e);
        }
    },

    clearQueue: () => {
        if (typeof localStorage === "undefined") return;
        localStorage.removeItem(QUEUE_KEY);
    },
};
