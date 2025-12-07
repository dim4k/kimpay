import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function createThemeStore() {
    const { subscribe, set, update } = writable<Theme>('light');

    return {
        subscribe,
        init: () => {
            if (!browser) return;
            
            const stored = localStorage.getItem('theme') as Theme;
            if (stored) {
                set(stored);
                if (stored === 'dark') {
                    document.documentElement.classList.add('dark');
                }
            } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                set('dark');
                document.documentElement.classList.add('dark');
            }
        },
        toggle: () => {
            update((current) => {
                const next = current === 'light' ? 'dark' : 'light';
                if (browser) {
                    localStorage.setItem('theme', next);
                    if (next === 'dark') {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                }
                return next;
            });
        }
    };
}

export const theme = createThemeStore();
