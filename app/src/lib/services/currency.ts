/**
 * Currency Service
 * 
 * Handles currency definitions, exchange rate fetching with daily caching,
 * and amount formatting with proper locale support.
 */

// =============================================================================
// Currency Definitions
// =============================================================================

export interface CurrencyInfo {
    code: string;
    symbol: string;
    name: string;
    decimals: number;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
    EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
    JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0 },
    GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
    AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
    CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimals: 2 },
    CHF: { code: 'CHF', symbol: 'Fr.', name: 'Swiss Franc', decimals: 2 },
    CNH: { code: 'CNH', symbol: '¥', name: 'Chinese Yuan', decimals: 2 },
} as const;

export const DEFAULT_CURRENCY = 'EUR';

export const CURRENCY_CODES = Object.keys(CURRENCIES) as (keyof typeof CURRENCIES)[];

// =============================================================================
// Exchange Rate API
// =============================================================================

const API_PRIMARY = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';
const API_FALLBACK = 'https://latest.currency-api.pages.dev/v1/currencies';

import { STORAGE_KEYS } from '$lib/constants';
const CACHE_KEY_PREFIX = STORAGE_KEYS.RATES_CACHE_PREFIX;

interface RatesCache {
    date: string;
    rates: Record<string, number>;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Get cached rates for today, if available
 */
function getCachedRates(): RatesCache | null {
    const today = getTodayDate();
    const cacheKey = `${CACHE_KEY_PREFIX}${today}`;
    
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            return JSON.parse(cached) as RatesCache;
        }
    } catch {
        // Ignore parse errors
    }
    
    return null;
}

/**
 * Save rates to cache
 */
function setCachedRates(rates: Record<string, number>): void {
    const today = getTodayDate();
    const cacheKey = `${CACHE_KEY_PREFIX}${today}`;
    
    // Clean old cache entries
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_KEY_PREFIX) && key !== cacheKey) {
            localStorage.removeItem(key);
        }
    }
    
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            date: today,
            rates
        }));
    } catch {
        // Ignore storage errors (quota, etc.)
    }
}

/**
 * Fetch rates from API (with fallback)
 */
async function fetchRatesFromAPI(baseCurrency: string): Promise<Record<string, number>> {
    const code = baseCurrency.toLowerCase();
    
    // Try primary API
    try {
        const response = await fetch(`${API_PRIMARY}/${code}.min.json`);
        if (response.ok) {
            const data = await response.json();
            return data[code] as Record<string, number>;
        }
    } catch {
        // Fall through to fallback
    }
    
    // Try fallback API
    const response = await fetch(`${API_FALLBACK}/${code}.min.json`);
    if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates for ${baseCurrency}`);
    }
    
    const data = await response.json();
    return data[code] as Record<string, number>;
}

/**
 * Get exchange rates (from cache or API)
 * Base currency is EUR for simplicity
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
    // Check cache first
    const cached = getCachedRates();
    if (cached) {
        return cached.rates;
    }
    
    // Fetch from API
    const rates = await fetchRatesFromAPI('eur');
    
    // Cache for today
    setCachedRates(rates);
    
    return rates;
}

/**
 * Check if rates are available in cache (for offline scenarios)
 */
export function hasRatesInCache(): boolean {
    return getCachedRates() !== null;
}

// =============================================================================
// Conversion & Formatting
// =============================================================================

/**
 * Convert amount from one currency to another
 * Rates are relative to EUR
 */
export function convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rates: Record<string, number>
): number {
    if (fromCurrency === toCurrency) {
        return amount;
    }
    
    const fromCode = fromCurrency.toLowerCase();
    const toCode = toCurrency.toLowerCase();
    
    // Get rates (relative to EUR)
    const fromRate = fromCode === 'eur' ? 1 : rates[fromCode];
    const toRate = toCode === 'eur' ? 1 : rates[toCode];
    
    if (!fromRate || !toRate) {
        if (import.meta.env.DEV) {
            console.warn(`Missing rate for ${fromCurrency} or ${toCurrency}`);
        }
        return amount;
    }
    
    // Convert: amount in FROM -> EUR -> TO
    const amountInEur = amount / fromRate;
    const result = amountInEur * toRate;
    
    // Round to proper decimals
    const decimals = CURRENCIES[toCurrency.toUpperCase()]?.decimals ?? 2;
    return Math.round(result * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Get currency symbol
 */
export function getSymbol(currencyCode: string): string {
    return CURRENCIES[currencyCode.toUpperCase()]?.symbol ?? currencyCode;
}

/**
 * Format amount with proper locale-aware formatting
 * Uses Intl.NumberFormat for correct symbol positioning
 */
export function formatAmount(amount: number, currencyCode: string, locale?: string): string {
    const currency = currencyCode.toUpperCase();
    const info = CURRENCIES[currency];
    
    if (!info) {
        return `${amount.toFixed(2)} ${currencyCode}`;
    }
    
    try {
        return new Intl.NumberFormat(locale ?? 'fr-FR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: info.decimals,
            maximumFractionDigits: info.decimals,
        }).format(amount);
    } catch {
        // Fallback for unsupported currencies (like CNH)
        return `${amount.toFixed(info.decimals)} ${info.symbol}`;
    }
}

/**
 * Format amount in compact form (just number + symbol)
 */
export function formatAmountCompact(amount: number, currencyCode: string): string {
    const info = CURRENCIES[currencyCode.toUpperCase()];
    const decimals = info?.decimals ?? 2;
    const symbol = info?.symbol ?? currencyCode;
    
    return `${amount.toFixed(decimals)}${symbol}`;
}
