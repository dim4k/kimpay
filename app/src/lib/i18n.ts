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

const pluralRules = new Map<string, Intl.PluralRules>();

/**
 * The key to read for `count`: "key_one" when the language says "1 expense"
 * (and "0 dépense" in French), "key" otherwise.
 */
function pluralKey(key: TranslationKey, lang: string, count: string): TranslationKey {
    if (!pluralRules.has(lang)) pluralRules.set(lang, new Intl.PluralRules(lang));
    const one = `${key}_one`;
    return pluralRules.get(lang)!.select(Number(count)) === "one" && one in en ? (one as TranslationKey) : key;
}

/**
 * Derived translation function store.
 * Usage: $t('key') or $t('key', { var: 'value' }); with a `count` variable,
 * the singular form ("key_one") when there is one.
 */
export const t = derived(
    locale,
    ($locale) =>
        (key: TranslationKey, vars: Record<string, string> = {}): string => {
            if (vars.count !== undefined) key = pluralKey(key, $locale, vars.count);
            let text = locales[$locale]?.[key] || locales["en"]?.[key] || key;

            // Variable replacement with {var} syntax
            Object.keys(vars).forEach((k) => {
                text = text.replaceAll(`{${k}}`, vars[k] || "");
            });

            return text;
        }
);
