import { writable } from 'svelte/store';
import { browser } from '$app/env';
import { STORAGE_KEYS } from '#lib/constants.js';
import { prefs } from '#lib/utils/prefs.js';

type Theme = 'light' | 'dark';

/** What the user picked: a theme, or follow the system ("Auto"). */
export type ThemeChoice = Theme | 'system';

function createThemeStore() {
    // The theme in use (what `$theme` reads).
    const { subscribe, set } = writable<Theme>('light');
    const choice = writable<ThemeChoice>('system');
    let current: ThemeChoice = 'system';
    let media: MediaQueryList | null = null;

    function apply() {
        const resolved: Theme = current === 'system' ? (media?.matches ? 'dark' : 'light') : current;
        set(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
    }

    return {
        subscribe,
        /** The user's choice, including "system" */
        choice: { subscribe: choice.subscribe },
        init: () => {
            if (!browser) return;
            media = window.matchMedia('(prefers-color-scheme: dark)');
            const stored = prefs.get(STORAGE_KEYS.THEME);
            current = stored === 'light' || stored === 'dark' ? stored : 'system';
            choice.set(current);
            apply();
            // Follows the system while no theme is picked.
            media.addEventListener('change', () => {
                if (current === 'system') apply();
            });
        },
        choose: (next: ThemeChoice) => {
            if (!browser) return;
            current = next;
            choice.set(next);
            prefs.set(STORAGE_KEYS.THEME, next === 'system' ? null : next);
            apply();
        },
    };
}

export const theme = createThemeStore();
