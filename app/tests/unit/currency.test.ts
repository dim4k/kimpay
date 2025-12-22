import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
    CURRENCIES, 
    DEFAULT_CURRENCY, 
    CURRENCY_CODES,
    convert,
    getSymbol,
    formatAmount,
    formatAmountCompact,
    hasRatesInCache
} from '../../src/lib/services/currency';

// Silence console.warn during tests (e.g., "Missing rate for EUR or XYZ")
beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('services/currency', () => {
    describe('CURRENCIES constant', () => {
        it('should have EUR as a currency', () => {
            expect(CURRENCIES.EUR).toBeDefined();
            expect(CURRENCIES.EUR.symbol).toBe('€');
            expect(CURRENCIES.EUR.decimals).toBe(2);
        });

        it('should have USD as a currency', () => {
            expect(CURRENCIES.USD).toBeDefined();
            expect(CURRENCIES.USD.symbol).toBe('$');
        });

        it('should have JPY with 0 decimals', () => {
            expect(CURRENCIES.JPY).toBeDefined();
            expect(CURRENCIES.JPY.decimals).toBe(0);
        });

        it('should have all expected currencies', () => {
            const expectedCurrencies = ['EUR', 'USD', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'CNH'];
            expectedCurrencies.forEach(code => {
                expect(CURRENCIES[code]).toBeDefined();
            });
        });
    });

    describe('DEFAULT_CURRENCY', () => {
        it('should be EUR', () => {
            expect(DEFAULT_CURRENCY).toBe('EUR');
        });
    });

    describe('CURRENCY_CODES', () => {
        it('should be an array of currency codes', () => {
            expect(Array.isArray(CURRENCY_CODES)).toBe(true);
            expect(CURRENCY_CODES).toContain('EUR');
            expect(CURRENCY_CODES).toContain('USD');
        });

        it('should match keys of CURRENCIES', () => {
            expect(CURRENCY_CODES).toEqual(Object.keys(CURRENCIES));
        });
    });

    describe('convert', () => {
        const mockRates = {
            eur: 1,
            usd: 1.1,
            gbp: 0.85,
            jpy: 160
        };

        it('should return same amount when currencies are equal', () => {
            expect(convert(100, 'EUR', 'EUR', mockRates)).toBe(100);
            expect(convert(50.5, 'USD', 'USD', mockRates)).toBe(50.5);
        });

        it('should convert EUR to USD', () => {
            const result = convert(100, 'EUR', 'USD', mockRates);
            expect(result).toBe(110); // 100 * 1.1
        });

        it('should convert USD to EUR', () => {
            const result = convert(110, 'USD', 'EUR', mockRates);
            expect(result).toBe(100); // 110 / 1.1
        });

        it('should convert between non-EUR currencies', () => {
            // USD to GBP: 110 USD -> 100 EUR -> 85 GBP
            const result = convert(110, 'USD', 'GBP', mockRates);
            expect(result).toBe(85);
        });

        it('should handle JPY with 0 decimals', () => {
            const result = convert(100, 'EUR', 'JPY', mockRates);
            expect(result).toBe(16000); // 100 * 160
            expect(Number.isInteger(result)).toBe(true);
        });

        it('should return original amount when rate is missing', () => {
            const result = convert(100, 'EUR', 'XYZ', mockRates);
            expect(result).toBe(100);
        });

        it('should be case-insensitive for currency codes', () => {
            const result1 = convert(100, 'eur', 'usd', mockRates);
            const result2 = convert(100, 'EUR', 'USD', mockRates);
            expect(result1).toBe(result2);
        });

        it('should round to proper decimal places', () => {
            const result = convert(33.333, 'EUR', 'USD', mockRates);
            expect(result).toBe(36.67); // Rounded to 2 decimals
        });
    });

    describe('getSymbol', () => {
        it('should return € for EUR', () => {
            expect(getSymbol('EUR')).toBe('€');
        });

        it('should return $ for USD', () => {
            expect(getSymbol('USD')).toBe('$');
        });

        it('should return currency code for unknown currencies', () => {
            expect(getSymbol('XYZ')).toBe('XYZ');
        });

        it('should be case-insensitive', () => {
            expect(getSymbol('eur')).toBe('€');
            expect(getSymbol('Eur')).toBe('€');
        });
    });

    describe('formatAmount', () => {
        it('should format EUR amounts', () => {
            const result = formatAmount(100.5, 'EUR', 'fr-FR');
            expect(result).toContain('100,50');
            expect(result).toContain('€');
        });

        it('should format USD amounts', () => {
            const result = formatAmount(100.5, 'USD', 'en-US');
            expect(result).toContain('100.50');
            expect(result).toContain('$');
        });

        it('should format JPY without decimals', () => {
            const result = formatAmount(1000, 'JPY', 'ja-JP');
            expect(result.includes('1,000') || result.includes('1000')).toBe(true);
            // Accept both ¥ (half-width) and ￥ (full-width) yen symbols
            expect(result.includes('¥') || result.includes('￥')).toBe(true);
        });

        it('should fallback for unknown currencies', () => {
            const result = formatAmount(100.5, 'XYZ', 'en-US');
            expect(result).toBe('100.50 XYZ');
        });
    });

    describe('formatAmountCompact', () => {
        it('should format EUR compactly', () => {
            expect(formatAmountCompact(100.5, 'EUR')).toBe('100.50€');
        });

        it('should format USD compactly', () => {
            expect(formatAmountCompact(100.5, 'USD')).toBe('100.50$');
        });

        it('should format JPY without decimals', () => {
            expect(formatAmountCompact(1000, 'JPY')).toBe('1000¥');
        });

        it('should handle unknown currencies', () => {
            expect(formatAmountCompact(100.5, 'XYZ')).toBe('100.50XYZ');
        });
    });

    describe('hasRatesInCache', () => {
        beforeEach(() => {
            // Mock localStorage
            const store: Record<string, string> = {};
            vi.stubGlobal('localStorage', {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => { store[key] = value; },
                removeItem: (key: string) => { delete store[key]; },
                clear: () => { Object.keys(store).forEach(k => delete store[k]); },
                length: Object.keys(store).length,
                key: (i: number) => Object.keys(store)[i] || null
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should return false when cache is empty', () => {
            expect(hasRatesInCache()).toBe(false);
        });
    });
});
