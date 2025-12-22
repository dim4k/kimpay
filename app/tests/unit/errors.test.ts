import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isNetworkError, getErrorMessage } from '../../src/lib/utils/errors';

describe('utils/errors', () => {
    describe('isNetworkError', () => {
        beforeEach(() => {
            // Mock navigator.onLine
            vi.stubGlobal('navigator', { onLine: true });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should return true for status 0', () => {
            expect(isNetworkError({ status: 0 })).toBe(true);
        });

        it('should return true when navigator is offline', () => {
            vi.stubGlobal('navigator', { onLine: false });
            expect(isNetworkError({ status: 500 })).toBe(true);
        });

        it('should return false for server errors when online', () => {
            vi.stubGlobal('navigator', { onLine: true });
            expect(isNetworkError({ status: 400 })).toBe(false);
            expect(isNetworkError({ status: 500 })).toBe(false);
        });

        it('should return false for successful responses', () => {
            expect(isNetworkError({ status: 200 })).toBe(false);
        });

        it('should handle missing status property', () => {
            vi.stubGlobal('navigator', { onLine: true });
            expect(isNetworkError({})).toBe(false);
            expect(isNetworkError(null)).toBe(false);
            expect(isNetworkError(undefined)).toBe(false);
        });

        it('should handle non-object errors', () => {
            expect(isNetworkError('error string')).toBe(false);
            expect(isNetworkError(new Error('test'))).toBe(false);
        });
    });

    describe('getErrorMessage', () => {
        const mockTranslate = (key: string) => {
            const translations: Record<string, string> = {
                'error.network': 'Connection error. Please try again.',
                'error.generic': 'Something went wrong. Please try again.'
            };
            return translations[key] || key;
        };

        beforeEach(() => {
            vi.stubGlobal('navigator', { onLine: true });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should return network error message for network errors', () => {
            const result = getErrorMessage({ status: 0 }, mockTranslate);
            expect(result).toBe('Connection error. Please try again.');
        });

        it('should return generic error message for server errors', () => {
            const result = getErrorMessage({ status: 500 }, mockTranslate);
            expect(result).toBe('Something went wrong. Please try again.');
        });

        it('should return network error when offline', () => {
            vi.stubGlobal('navigator', { onLine: false });
            const result = getErrorMessage({ status: 400 }, mockTranslate);
            expect(result).toBe('Connection error. Please try again.');
        });

        it('should handle Error objects', () => {
            const result = getErrorMessage(new Error('test'), mockTranslate);
            expect(result).toBe('Something went wrong. Please try again.');
        });
    });
});
