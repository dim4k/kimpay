import { writable } from 'svelte/store';
import { browser } from '$app/env';

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
            const stored = localStorage.getItem('theme');
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
            try {
                if (next === 'system') localStorage.removeItem('theme');
                else localStorage.setItem('theme', next);
            } catch {
                // Not remembered, still applied.
            }
            apply();
        },
    };
}

export const theme = createThemeStore();
