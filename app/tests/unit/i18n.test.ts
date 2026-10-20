import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { locale, locales, t, type TranslationKey } from '../../src/lib/i18n';

function translate(lang: string, key: TranslationKey, vars: Record<string, string> = {}): string {
    locale.set(lang);
    return get(t)(key, vars);
}

describe('i18n', () => {
    it('picks the singular form for one', () => {
        expect(translate('en', 'expense.list.count', { count: '1' })).toBe('1 expense');
        expect(translate('en', 'expense.list.count', { count: '3' })).toBe('3 expenses');
        expect(translate('en', 'expense.list.count', { count: '0' })).toBe('0 expenses');
    });

    it('says "0 dépense" in French', () => {
        expect(translate('fr', 'expense.list.count', { count: '0' })).toBe('0 dépense');
        expect(translate('fr', 'filter.results', { count: '2' })).toBe('2 résultats');
    });

    it('keeps the base key when there is no singular form', () => {
        expect(translate('en', 'home.archive.title', { count: '1' })).toBe('Archived (1)');
    });

    it('replaces a variable used twice', () => {
        expect(translate('en', 'members.merge.desc', { name: 'Léa' }).match(/Léa/g)).toHaveLength(2);
    });

    it.each(Object.keys(locales))('writes no "(s)" plurals in %s', (lang) => {
        const pseudo = Object.entries(locales[lang]!).filter(([, text]) => /\w\((s|e|n|en|es|er|a|se)\)/.test(text));
        expect(pseudo).toEqual([]);
    });

    it('writes English in sentence case', () => {
        // "Sign Up", "Confirm Payment": a capital after the first word (names and acronyms aside).
        const allowed = /\b(Kimpay|Kimpays|PayPal|Revolut|CSV|Markdown|QR|HTTPS|Safari|iPhone|Home|Screen|I|Earth|Lisbon)\b/g;
        const titled = Object.entries(locales.en!).filter(([, text]) =>
            text.replace(allowed, '').split(/[.!?:]\s+/).some((sentence) => /^\S+.*\s[A-Z][a-z]/.test(sentence)),
        );
        expect(titled).toEqual([]);
    });
});
