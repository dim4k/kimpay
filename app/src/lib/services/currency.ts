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
    EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
    USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
    JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
    GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
    AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
    CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2 },
    CHF: { code: "CHF", symbol: "Fr.", name: "Swiss Franc", decimals: 2 },
    CNH: { code: "CNH", symbol: "¥", name: "Chinese Yuan", decimals: 2 },
    VND: { code: "VND", symbol: "₫", name: "Vietnamese Dong", decimals: 0 },
} as const;

export const DEFAULT_CURRENCY = "EUR";

export const CURRENCY_CODES = Object.keys(
    CURRENCIES,
) as (keyof typeof CURRENCIES)[];

// =============================================================================
// Exchange Rate API
// =============================================================================

const API_PRIMARY =
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";
const API_FALLBACK = "https://latest.currency-api.pages.dev/v1/currencies";

import { STORAGE_KEYS } from "#lib/constants.js";
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
        localStorage.setItem(
            cacheKey,
            JSON.stringify({
                date: today,
                rates,
            }),
        );
    } catch {
        // Ignore storage errors (quota, etc.)
    }
}

/**
 * Fetch rates from API (with fallback)
 */
async function fetchRatesFromAPI(
    baseCurrency: string,
): Promise<Record<string, number>> {
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
    const rates = await fetchRatesFromAPI("eur");

    // Cache for today
    setCachedRates(rates);

    return rates;
}

// Historical rates never change: kept for the session, per day.
const historicalRates = new Map<string, Promise<Record<string, number> | null>>();

/** EUR-based rates of a past day ("YYYY-MM-DD"), or null when unavailable. */
function getHistoricalRates(day: string): Promise<Record<string, number> | null> {
    let pending = historicalRates.get(day);
    if (!pending) {
        pending = (async () => {
            const urls = [
                `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${day}/v1/currencies/eur.min.json`,
                `https://${day}.currency-api.pages.dev/v1/currencies/eur.min.json`,
            ];
            for (const url of urls) {
                try {
                    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
                    if (response.ok) return ((await response.json()).eur as Record<string, number>) ?? null;
                } catch {
                    // Try the next mirror.
                }
            }
            return null;
        })();
        historicalRates.set(day, pending);
        // Do not cache failures (offline...): retry on the next call.
        pending.then((rates) => rates || historicalRates.delete(day));
    }
    return pending;
}

/** Rate to convert an amount from `from` to `to`, given EUR-based rates (0 if unknown). */
export function rateBetween(from: string, to: string, rates: Record<string, number>): number {
    const fromRate = from.toLowerCase() === "eur" ? 1 : rates[from.toLowerCase()];
    const toRate = to.toLowerCase() === "eur" ? 1 : rates[to.toLowerCase()];
    return fromRate && toRate ? toRate / fromRate : 0;
}

/**
 * Exchange rate from `from` to `to` on a given day ("YYYY-MM-DD"), used to
 * freeze the value of an expense at its date. Falls back to today's rates
 * (cached or fetched), and returns 0 when no rate can be found (offline).
 */
export async function getExchangeRateAt(from: string, to: string, day: string): Promise<number> {
    if (from === to) return 1;

    if (day < getTodayDate()) {
        const rates = await getHistoricalRates(day);
        const rate = rates ? rateBetween(from, to, rates) : 0;
        if (rate) return rate;
    }

    try {
        return rateBetween(from, to, await getExchangeRates());
    } catch {
        return 0;
    }
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
    rates: Record<string, number>,
): number {
    if (fromCurrency === toCurrency) {
        return amount;
    }

    const fromCode = fromCurrency.toLowerCase();
    const toCode = toCurrency.toLowerCase();

    // Get rates (relative to EUR)
    const fromRate = fromCode === "eur" ? 1 : rates[fromCode];
    const toRate = toCode === "eur" ? 1 : rates[toCode];

    if (fromRate === undefined || toRate === undefined) {
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
/**
 * Currency name in the given language (e.g. "dollar des États-Unis"),
 * falling back to the English name.
 */
export function getCurrencyName(currencyCode: string, locale: string): string {
    const code = currencyCode.toUpperCase();
    try {
        const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code);
        if (name && name !== code) return name;
    } catch {
        // Unsupported locale/code: use the built-in English name.
    }
    return CURRENCIES[code]?.name ?? code;
}

export function getSymbol(currencyCode: string): string {
    return CURRENCIES[currencyCode.toUpperCase()]?.symbol ?? currencyCode;
}

/**
 * Format amount with proper locale-aware formatting
 * Uses Intl.NumberFormat for correct symbol positioning
 */
export function formatAmount(
    amount: number,
    currencyCode: string,
    locale?: string,
): string {
    const currency = currencyCode.toUpperCase();
    const info = CURRENCIES[currency];

    if (!info) {
        return `${amount.toFixed(2)} ${currencyCode}`;
    }

    try {
        return new Intl.NumberFormat(locale ?? "fr-FR", {
            style: "currency",
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
/**
 * An amount in few characters, for a badge: whole units from 10 up
 * ("14 €" for 13.59 €), with its decimals below.
 */
export function formatAmountShort(amount: number, currencyCode: string, locale?: string): string {
    const currency = currencyCode.toUpperCase();
    const decimals = Math.abs(amount) < 10 ? CURRENCIES[currency]?.decimals ?? 2 : 0;
    try {
        return new Intl.NumberFormat(locale ?? "fr-FR", {
            style: "currency",
            currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(amount);
    } catch {
        return `${amount.toFixed(decimals)} ${currencyCode}`;
    }
}

export function formatAmountCompact(
    amount: number,
    currencyCode: string,
): string {
    const info = CURRENCIES[currencyCode.toUpperCase()];
    const decimals = info?.decimals ?? 2;
    const symbol = info?.symbol ?? currencyCode;

    return `${amount.toFixed(decimals)}${symbol}`;
}
