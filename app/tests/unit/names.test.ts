import { describe, it, expect } from 'vitest';
import { findSimilarName, sameFirstName } from '../../src/lib/utils/names';

describe('similar names', () => {
    it('compares the first word, whatever the case and accents', () => {
        expect(sameFirstName('pierre', 'Pierre M.')).toBe(true);
        expect(sameFirstName('Pièrre', 'PIERRE')).toBe(true);
        expect(sameFirstName('Jean-Paul', 'jean paul')).toBe(true);
        expect(sameFirstName('Pierre', 'Paul')).toBe(false);
        expect(sameFirstName('P', 'P.')).toBe(false);
        expect(sameFirstName('', '')).toBe(false);
    });

    it('finds the first similar person', () => {
        const people = [{ name: 'Alice' }, { name: 'Pierre M.' }];
        expect(findSimilarName('pierre', people)).toEqual({ name: 'Pierre M.' });
        expect(findSimilarName('Bob', people)).toBeNull();
    });
});
