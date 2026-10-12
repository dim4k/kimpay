import { describe, it, expect } from 'vitest';
import { isEmoji, normalize, searchEmojis } from '../../src/lib/emoji/search';
import fr from '../../src/lib/emoji/keywords/fr.json';
import en from '../../src/lib/emoji/keywords/en.json';

const emojis = ['🍕', '🍔', '🚆', '🏨', '✈️', '☕'];

describe('emoji/search', () => {
    it('finds emojis by the start of their words, in French and English', () => {
        expect(searchEmojis('pizz', emojis, [fr, en])).toEqual(['🍕']);
        expect(searchEmojis('hôtel', emojis, [fr, en])).toEqual(['🏨']);
        expect(searchEmojis('hotel', emojis, [fr, en])).toEqual(['🏨']);
        expect(searchEmojis('burger', emojis, [fr, en])).toEqual(['🍔']);
    });

    it('matches emojis written with or without the presentation selector', () => {
        expect(searchEmojis('avion', emojis, [fr])).toEqual(['✈️']);
    });

    it('needs every word of the query', () => {
        expect(searchEmojis('pizza train', emojis, [fr, en])).toEqual([]);
    });

    it('uses extra words (category names)', () => {
        expect(searchEmojis('transports', emojis, [fr], { '🚆': 'Transports', '✈️': 'Transports' })).toEqual(['🚆', '✈️']);
    });

    it('returns nothing for an empty query', () => {
        expect(searchEmojis('  ', emojis, [fr])).toEqual([]);
    });

    it('recognizes a typed emoji', () => {
        expect(isEmoji('🦄')).toBe(true);
        expect(isEmoji('pizza')).toBe(false);
    });

    it('normalizes accents and case', () => {
        expect(normalize('Hôtel Café')).toBe('hotel cafe');
    });
});
