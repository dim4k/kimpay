import { derived, writable } from "svelte/store";
import { en, type TranslationKey } from "./locales/en";
import { fr } from "./locales/fr";

export type { TranslationKey };

export const locales: Record<string, Record<TranslationKey, string>> = {
    en,
    fr,
};

function getInitialLocale(): string {
    if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem("locale");
        if (saved && saved in locales) return saved;
    }
    if (typeof navigator !== "undefined") {
        const lang = navigator.language?.split("-")[0];
        return lang && lang in locales ? lang : "en";
    }
    return "en";
}

/** Writable store for the current locale */
export const locale = writable(getInitialLocale());

// Persist locale changes to localStorage
locale.subscribe((value) => {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem("locale", value);
    }
});

/**
 * Derived translation function store.
 * Usage: $t('key') or $t('key', { var: 'value' })
 */
export const t = derived(
    locale,
    ($locale) =>
        (key: TranslationKey, vars: Record<string, string> = {}): string => {
            let text = locales[$locale]?.[key] || locales["en"]?.[key] || key;

            // Variable replacement with {var} syntax
            Object.keys(vars).forEach((k) => {
                const regex = new RegExp(`{${k}}`, "g");
                text = text.replace(regex, vars[k] || "");
            });

            return text;
        }
);
