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
                } else {
                    document.documentElement.classList.remove('dark');
                }
            } else {
                // If no stored preference, use system preference (Default to Light if no system preference)
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                
                const applySystem = (matches: boolean) => {
                    if (matches) {
                        set('dark');
                        document.documentElement.classList.add('dark');
                    } else {
                        set('light');
                        document.documentElement.classList.remove('dark');
                    }
                };
                
                applySystem(mediaQuery.matches);
                
                // Listen for system changes
                mediaQuery.addEventListener('change', (e) => {
                    // Only apply if user hasn't manually overridden
                    if (!localStorage.getItem('theme')) {
                        applySystem(e.matches);
                    }
                });
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
