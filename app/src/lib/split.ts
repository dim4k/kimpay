import type { Expense, ExpenseSplit, SplitMode } from './types';
import { CURRENCIES, DEFAULT_CURRENCY } from './services/currency';

/** Number of decimals of a currency (2 when unknown). */
export function currencyDecimals(currency: string): number {
    return CURRENCIES[currency.toUpperCase()]?.decimals ?? 2;
}

/** Amount -> integer number of minor units (cents...). */
export function toMinor(amount: number, currency: string): number {
    return Math.round(amount * 10 ** currencyDecimals(currency));
}

/** Integer number of minor units -> amount. */
export function fromMinor(minor: number, currency: string): number {
    return minor / 10 ** currencyDecimals(currency);
}

/**
 * Weight of each participant in an expense, keyed by participant ID.
 * Equal split = weight 1 each; for shares / amounts / percent the weight is
 * the value itself (an amount split is a split proportional to the amounts).
 *
 * Only `participantIds` (the current participants) are kept. An expense with
 * no `involved` concerns everyone. Falls back to an equal split when the
 * values give nobody a positive weight.
 */
export function splitWeights(expense: Pick<Expense, 'involved' | 'split'>, participantIds: string[]): Record<string, number> {
    const known = new Set(participantIds);
    const involved = (expense.involved?.length ? expense.involved : participantIds).filter((id) => known.has(id));

    const weights: Record<string, number> = {};
    const values = expense.split?.values;
    if (expense.split && expense.split.mode !== 'equal' && values) {
        for (const id of involved) {
            const value = Number(values[id]);
            if (value > 0) weights[id] = value;
        }
        if (Object.keys(weights).length > 0) return weights;
    }

    for (const id of involved) weights[id] = 1;
    return weights;
}

/**
 * Split an integer `total` (minor units) proportionally to `weights`, without
 * losing or creating a single cent: the leftover units go to the largest
 * remainders (ties broken by ID, so every client gets the same result).
 */
export function distribute(total: number, weights: Record<string, number>): Record<string, number> {
    const ids = Object.keys(weights).sort();
    const sum = ids.reduce((acc, id) => acc + weights[id]!, 0);
    const result: Record<string, number> = {};
    if (ids.length === 0 || sum <= 0) return result;

    const exact = ids.map((id) => ({ id, value: (total * weights[id]!) / sum }));
    let left = total;
    for (const { id, value } of exact) {
        result[id] = Math.floor(value);
        left -= result[id]!;
    }
    exact
        .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)) || (a.id < b.id ? -1 : 1))
        .slice(0, left)
        .forEach(({ id }) => result[id]!++);
    return result;
}

/**
 * Share of each participant in an expense, in the expense's own currency.
 * Used for display (details, exports); balances work in minor units.
 */
export function expenseShares(expense: Expense, participantIds: string[]): Record<string, number> {
    const currency = expense.currency || DEFAULT_CURRENCY;
    const minor = distribute(toMinor(expense.amount, currency), splitWeights(expense, participantIds));
    return Object.fromEntries(Object.entries(minor).map(([id, value]) => [id, fromMinor(value, currency)]));
}

/** Whether an expense is not split equally (worth showing each share). */
export function isCustomSplit(expense: Pick<Expense, 'split'>): boolean {
    return !!expense.split && expense.split.mode !== 'equal';
}

export interface SplitCheck {
    valid: boolean;
    /** amounts: amount left to assign; percent: percentage left to assign */
    remaining: number;
}

/**
 * Validate the values typed in the split editor, for the participants
 * involved in the expense. `amount` is the expense total.
 */
export function checkSplit(mode: SplitMode, values: Record<string, number>, involved: string[], amount: number, currency: string): SplitCheck {
    const list = involved.map((id) => values[id] ?? 0);
    if (list.some((v) => !Number.isFinite(v) || v < 0)) return { valid: false, remaining: 0 };
    const total = list.reduce((a, b) => a + b, 0);

    switch (mode) {
        case 'equal':
            return { valid: involved.length > 0, remaining: 0 };
        case 'shares':
            return { valid: total > 0, remaining: 0 };
        case 'percent': {
            const remaining = Math.round((100 - total) * 100) / 100;
            return { valid: remaining === 0, remaining };
        }
        case 'amounts': {
            const remaining = fromMinor(toMinor(amount, currency) - list.reduce((a, v) => a + toMinor(v, currency), 0), currency);
            return { valid: amount > 0 && remaining === 0, remaining };
        }
    }
}

/**
 * Default values when switching the split editor to `mode`: one share each,
 * or the equal split expressed in percent / amounts.
 */
export function defaultSplitValues(mode: SplitMode, involved: string[], amount: number, currency: string): Record<string, number> {
    if (mode === 'equal' || involved.length === 0) return {};
    if (mode === 'shares') return Object.fromEntries(involved.map((id) => [id, 1]));

    const weights = Object.fromEntries(involved.map((id) => [id, 1]));
    if (mode === 'percent') {
        const parts = distribute(100 * 100, weights);
        return Object.fromEntries(involved.map((id) => [id, parts[id]! / 100]));
    }
    const parts = distribute(toMinor(amount || 0, currency), weights);
    return Object.fromEntries(involved.map((id) => [id, fromMinor(parts[id]!, currency)]));
}

/** The split to store, keeping only the values of involved participants. */
export function buildSplit(mode: SplitMode, values: Record<string, number>, involved: string[]): ExpenseSplit {
    if (mode === 'equal') return { mode };
    return { mode, values: Object.fromEntries(involved.map((id) => [id, values[id] ?? 0])) };
}
