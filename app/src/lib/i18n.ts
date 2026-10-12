import { derived, writable } from "svelte/store";
import { en, type TranslationKey } from "./locales/en";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { es } from "./locales/es";
import { pt } from "./locales/pt";
import { STORAGE_KEYS } from "./constants";
import { prefs } from "./utils/prefs";

export type { TranslationKey };

export const locales: Record<string, Record<TranslationKey, string>> = {
    en,
    fr,
    de,
    es,
    pt,
};

/** Each language in its own language, for the language switcher */
export const LOCALE_NAMES: Record<string, string> = {
    en: "English",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
    pt: "Português",
};

function getInitialLocale(): string {
    const saved = prefs.get(STORAGE_KEYS.LOCALE);
    if (saved && saved in locales) return saved;
    if (typeof navigator !== "undefined") {
        const lang = navigator.language?.split("-")[0];
        return lang && lang in locales ? lang : "en";
    }
    return "en";
}

/** Writable store for the current locale */
export const locale = writable(getInitialLocale());

// Remembered on this device
locale.subscribe((value) => prefs.set(STORAGE_KEYS.LOCALE, value));

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
