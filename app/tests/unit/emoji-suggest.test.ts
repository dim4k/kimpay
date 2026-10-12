import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COMMON_EXPENSE_WORDS, suggestEmoji } from '../../src/lib/emoji/suggest';
import { EMOJI_CATEGORIES, emojiCategory } from '../../src/lib/constants';

const fr = JSON.parse(readFileSync(new URL('../../src/lib/emoji/keywords/fr.json', import.meta.url), 'utf8'));
const en = JSON.parse(readFileSync(new URL('../../src/lib/emoji/keywords/en.json', import.meta.url), 'utf8'));

describe('suggestEmoji', () => {
    it('finds the common words, whatever the case and accents', () => {
        expect(suggestEmoji('Resto italien')).toBe('🍽️');
        expect(suggestEmoji("Plein d'essence")).toBe('⛽');
        expect(suggestEmoji('Péage A6')).toBe('🚗');
        expect(suggestEmoji('Courses Carrefour')).toBe('🛒');
        expect(suggestEmoji('AIRBNB Lisbonne')).toBe('🏠');
        expect(suggestEmoji('Groceries')).toBe('🛒');
        expect(suggestEmoji('Abendessen')).toBe('🍽️');
    });

    it('takes the word that comes first', () => {
        expect(suggestEmoji('Essence et péage')).toBe('⛽');
        expect(suggestEmoji('Péage et essence')).toBe('🚗');
        expect(suggestEmoji('Petit déjeuner')).toBe('🥐');
        expect(suggestEmoji('Forfait ski')).toBe('⛷️');
        expect(suggestEmoji('Location voiture')).toBe('🚗');
    });

    it('matches whole words only', () => {
        expect(suggestEmoji('Barbecue')).not.toBe('🍹');
        expect(suggestEmoji('Volley')).toBeNull();
    });

    it('falls back on the emoji names for longer words', () => {
        expect(suggestEmoji('Sandwich jambon', [fr, en])).toBe('🥪');
        expect(suggestEmoji('Xyzzy', [fr, en])).toBeNull();
    });

    it('suggests nothing for an empty description', () => {
        expect(suggestEmoji('')).toBeNull();
        expect(suggestEmoji('  ')).toBeNull();
    });

    it('only suggests emojis of an expense category', () => {
        for (const [emoji] of COMMON_EXPENSE_WORDS) {
            expect(emojiCategory(emoji), emoji).not.toBe('OTHER');
        }
        expect(EMOJI_CATEGORIES.FOOD!.emojis[0]).toBe('🍕');
    });
});
