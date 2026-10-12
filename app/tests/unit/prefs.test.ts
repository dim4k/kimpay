import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prefs } from '../../src/lib/utils/prefs';

function memoryStorage(): Storage {
    const data = new Map<string, string>();
    return {
        get length() { return data.size; },
        clear: () => data.clear(),
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, String(value)),
        removeItem: (key) => void data.delete(key),
        key: (i) => [...data.keys()][i] ?? null,
    };
}

describe('prefs', () => {
    beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
    afterEach(() => vi.unstubAllGlobals());

    it('reads back what it wrote, and forgets on null', () => {
        prefs.set('k', 'v');
        expect(prefs.get('k')).toBe('v');
        prefs.set('k', null);
        expect(prefs.get('k')).toBeNull();
    });

    it('stores JSON, and reads broken JSON as missing', () => {
        prefs.setJSON('j', { a: 1 });
        expect(prefs.getJSON('j')).toEqual({ a: 1 });
        localStorage.setItem('j', '{broken');
        expect(prefs.getJSON('j')).toBeNull();
    });

    it('works without storage (private mode, blocked site data)', () => {
        const throwing = () => { throw new Error('SecurityError'); };
        vi.stubGlobal('localStorage', { getItem: throwing, setItem: throwing, removeItem: throwing });
        expect(prefs.get('k')).toBeNull();
        expect(() => prefs.set('k', 'v')).not.toThrow();
        expect(() => prefs.set('k', null)).not.toThrow();
    });
});
