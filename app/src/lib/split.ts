import type { Expense, ExpenseSplit, Participant, SplitMode } from './types';
import { CURRENCIES, DEFAULT_CURRENCY } from './services/currency';
import { defaultSharesOf } from './utils/members';

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
 * Exact (fractional) split of `total` proportionally to `weights`. Balances
 * add these up and round once at the end: rounding every expense would put
 * its indivisible cents on the same people each time.
 */
export function exactShares(total: number, weights: Record<string, number>): Record<string, number> {
    const ids = Object.keys(weights);
    const sum = ids.reduce((acc, id) => acc + weights[id]!, 0);
    if (ids.length === 0 || sum <= 0) return {};
    return Object.fromEntries(ids.map((id) => [id, (total * weights[id]!) / sum]));
}

/**
 * Round fractional minor units to integers adding up exactly to `total`: the
 * leftover units go to the largest remainders (ties broken by ID, so every
 * client gets the same result).
 */
export function roundToSum(values: Record<string, number>, total: number): Record<string, number> {
    const ids = Object.keys(values).sort();
    const result: Record<string, number> = {};
    let left = total;
    for (const id of ids) {
        result[id] = Math.floor(values[id]!);
        left -= result[id]!;
    }
    const fraction = (id: string) => values[id]! - result[id]!;
    [...ids]
        .sort((a, b) => fraction(b) - fraction(a) || (a < b ? -1 : 1))
        .slice(0, Math.round(left))
        .forEach((id) => result[id]!++);
    return result;
}

/**
 * Split an integer `total` (minor units) proportionally to `weights`, without
 * losing or creating a single cent (see roundToSum).
 */
export function distribute(total: number, weights: Record<string, number>): Record<string, number> {
    return roundToSum(exactShares(total, weights), total);
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
 * Default values when switching the split editor to `mode`: one share each
 * (or the members' default shares, `weights`), or that split expressed in
 * percent / amounts.
 */
export function defaultSplitValues(
    mode: SplitMode,
    involved: string[],
    amount: number,
    currency: string,
    weights: Record<string, number> = {},
): Record<string, number> {
    if (mode === 'equal' || involved.length === 0) return {};
    const shares = Object.fromEntries(involved.map((id) => [id, weights[id] ?? 1]));
    if (mode === 'shares') return shares;

    if (mode === 'percent') {
        const parts = distribute(100 * 100, shares);
        return Object.fromEntries(involved.map((id) => [id, parts[id]! / 100]));
    }
    const parts = distribute(toMinor(amount || 0, currency), shares);
    return Object.fromEntries(involved.map((id) => [id, fromMinor(parts[id]!, currency)]));
}

/** The shares each member counts for in a new expense (1 unless set). */
export function memberWeights(participants: readonly Pick<Participant, 'id' | 'default_shares'>[]): Record<string, number> {
    return Object.fromEntries(participants.map((p) => [p.id, defaultSharesOf(p)]));
}

/**
 * Who a new expense is for, and how it is split, before any change: the
 * members still taking part (everyone if none is), by shares when one of
 * them counts for more than one.
 */
export function newExpenseDefaults(
    participants: readonly Pick<Participant, 'id' | 'inactive' | 'default_shares'>[],
): { involved: string[]; split: ExpenseSplit } {
    const active = participants.filter((p) => !p.inactive);
    const involved = (active.length > 0 ? active : participants).map((p) => p.id);
    const weights = memberWeights(participants);
    if (!involved.some((id) => weights[id]! > 1)) return { involved, split: { mode: 'equal' } };
    return { involved, split: { mode: 'shares', values: defaultSplitValues('shares', involved, 0, DEFAULT_CURRENCY, weights) } };
}

/** The split to store, keeping only the values of involved participants. */
export function buildSplit(mode: SplitMode, values: Record<string, number>, involved: string[]): ExpenseSplit {
    if (mode === 'equal') return { mode };
    return { mode, values: Object.fromEntries(involved.map((id) => [id, values[id] ?? 0])) };
}
