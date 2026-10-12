import { describe, it, expect } from 'vitest';
import { formatDecimal, parseDecimal, sanitizeDecimal } from '../../src/lib/utils/amount';

describe('decimal fields', () => {
    it('keeps digits and one separator, two decimals', () => {
        expect(sanitizeDecimal('12,345')).toBe('12,34');
        expect(sanitizeDecimal('1.2.3')).toBe('1.23');
        expect(sanitizeDecimal('€ 4a5')).toBe('45');
        expect(sanitizeDecimal('123456789')).toBe('12345678');
        expect(sanitizeDecimal('1234,5', 3)).toBe('123,5');
    });

    it('reads a comma or a dot', () => {
        expect(parseDecimal('10,5')).toBe(10.5);
        expect(parseDecimal('10.5')).toBe(10.5);
        expect(parseDecimal('')).toBe(0);
        expect(parseDecimal(',')).toBe(0);
    });

    it('shows a value with the separator of the language', () => {
        expect(formatDecimal(10.5, 'fr')).toBe('10,5');
        expect(formatDecimal(1234.5, 'en')).toBe('1234.5');
        expect(formatDecimal(undefined, 'en')).toBe('');
    });
});
