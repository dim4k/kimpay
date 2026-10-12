/**
 * Small preferences of this device, in localStorage (sort order, theme...).
 *
 * Storage can be missing or throw (private mode, blocked site data): reads
 * then return null and writes are skipped. The app works the same, it just
 * does not remember.
 */
export const prefs = {
    get(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },

    /** `null` forgets the key. */
    set(key: string, value: string | null): void {
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch {
            // Not remembered, still applied for this session.
        }
    },

    getJSON<T>(key: string): T | null {
        const raw = prefs.get(key);
        if (raw === null) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    },

    setJSON(key: string, value: unknown): void {
        prefs.set(key, value === null || value === undefined ? null : JSON.stringify(value));
    },
};
