import { describe, it, expect } from 'vitest';
import { calculateBalances, calculateDebts, paidBy, toKimpayAmount, totalSpent } from '../../src/lib/balance';
import { buildSplit, checkSplit, defaultSplitValues, distribute, expenseShares, memberWeights, newExpenseDefaults, splitWeights } from '../../src/lib/split';
import type { Expense, Participant } from '../../src/lib/types';

const participants = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase() }) as Participant);
const ids = participants.map((p) => p.id);

const expense = (overrides: Partial<Expense>): Expense => ({
    id: 'e1',
    collectionId: 'expenses',
    collectionName: 'expenses',
    created: '',
    updated: '',
    amount: 90,
    description: 'Test',
    date: '2026-01-15 00:00:00.000Z',
    payer: 'a',
    involved: ['a', 'b', 'c'],
    kimpay: 'k',
    created_by: 'a',
    is_reimbursement: false,
    currency: 'EUR',
    ...overrides,
});

describe('split/distribute', () => {
    it('never loses or creates a cent', () => {
        const parts = distribute(10000, { a: 1, b: 1, c: 1 });
        expect(Object.values(parts).reduce((x, y) => x + y, 0)).toBe(10000);
        expect(Object.values(parts).sort()).toEqual([3333, 3333, 3334]);
    });

    it('is deterministic whatever the key order', () => {
        expect(distribute(100, { c: 1, b: 1, a: 1 })).toEqual(distribute(100, { a: 1, b: 1, c: 1 }));
    });

    it('splits proportionally to the weights', () => {
        expect(distribute(3000, { a: 2, b: 1 })).toEqual({ a: 2000, b: 1000 });
    });
});

describe('split/splitWeights', () => {
    it('defaults to one share each, everyone when nobody is involved', () => {
        expect(splitWeights({ involved: [], split: null }, ids)).toEqual({ a: 1, b: 1, c: 1 });
    });

    it('ignores participants that no longer exist', () => {
        expect(splitWeights({ involved: ['a', 'gone'], split: { mode: 'shares', values: { a: 2, gone: 5 } } }, ids)).toEqual({ a: 2 });
    });

    it('falls back to equal when no value is positive', () => {
        expect(splitWeights({ involved: ['a', 'b'], split: { mode: 'percent', values: { a: 0 } } }, ids)).toEqual({ a: 1, b: 1 });
    });
});

describe('split/checkSplit', () => {
    it('wants percentages adding up to 100', () => {
        expect(checkSplit('percent', { a: 50, b: 30 }, ['a', 'b'], 10, 'EUR')).toEqual({ valid: false, remaining: 20 });
        expect(checkSplit('percent', { a: 33.33, b: 66.67 }, ['a', 'b'], 10, 'EUR').valid).toBe(true);
    });

    it('wants amounts adding up to the total', () => {
        expect(checkSplit('amounts', { a: 7, b: 2.5 }, ['a', 'b'], 10, 'EUR')).toEqual({ valid: false, remaining: 0.5 });
        expect(checkSplit('amounts', { a: 7.5, b: 2.5 }, ['a', 'b'], 10, 'EUR').valid).toBe(true);
        expect(checkSplit('amounts', { a: 8, b: 3 }, ['a', 'b'], 10, 'EUR').remaining).toBe(-1);
    });

    it('rejects negative values and all-zero shares', () => {
        expect(checkSplit('shares', { a: -1, b: 2 }, ['a', 'b'], 10, 'EUR').valid).toBe(false);
        expect(checkSplit('shares', { a: 0, b: 0 }, ['a', 'b'], 10, 'EUR').valid).toBe(false);
    });
});

describe('split/defaults', () => {
    it('starts from an equal split in every mode', () => {
        expect(defaultSplitValues('shares', ['a', 'b'], 10, 'EUR')).toEqual({ a: 1, b: 1 });
        expect(defaultSplitValues('amounts', ['a', 'b', 'c'], 10, 'EUR')).toEqual({ a: 3.34, b: 3.33, c: 3.33 });
        const percent = defaultSplitValues('percent', ['a', 'b', 'c'], 10, 'EUR');
        expect(checkSplit('percent', percent, ['a', 'b', 'c'], 10, 'EUR').valid).toBe(true);
    });

    it('only stores the values of involved participants', () => {
        expect(buildSplit('shares', { a: 2, b: 1, c: 4 }, ['a', 'b'])).toEqual({ mode: 'shares', values: { a: 2, b: 1 } });
        expect(buildSplit('equal', { a: 2 }, ['a'])).toEqual({ mode: 'equal' });
    });
});

describe('balances with custom splits', () => {
    it('applies shares', () => {
        const e = expense({ split: { mode: 'shares', values: { a: 1, b: 2, c: 0 } }, involved: ['a', 'b'] });
        expect(calculateBalances([e], participants)).toEqual({ a: 60, b: -60, c: 0 });
    });

    it('applies exact amounts', () => {
        const e = expense({ amount: 50, split: { mode: 'amounts', values: { a: 10, b: 15, c: 25 } } });
        expect(calculateBalances([e], participants)).toEqual({ a: 40, b: -15, c: -25 });
    });

    it('applies percentages', () => {
        const e = expense({ amount: 200, split: { mode: 'percent', values: { a: 50, b: 25, c: 25 } } });
        expect(calculateBalances([e], participants)).toEqual({ a: 100, b: -50, c: -50 });
    });

    it('keeps balances summing to exactly zero', () => {
        const e = expense({ amount: 100 });
        const balances = calculateBalances([e], participants);
        expect(Object.values(balances).reduce((x, y) => x + y, 0)).toBeCloseTo(0, 10);
        expect(expenseShares(e, ids)).toEqual({ a: 33.34, b: 33.33, c: 33.33 });
    });
});

describe('money received', () => {
    it('makes the receiver owe the others their share', () => {
        const e = expense({ amount: 30, payer: 'a', involved: ['a', 'b', 'c'], is_income: true });
        expect(calculateBalances([e], participants)).toEqual({ a: -20, b: 10, c: 10 });
        expect(calculateDebts([e], participants).map((tx) => [tx.from, tx.to, tx.amount])).toEqual([
            ['a', 'b', 10],
            ['a', 'c', 10],
        ]);
    });

    it('is deducted from the total spent', () => {
        const expenses = [expense({ amount: 100 }), expense({ amount: 30, is_income: true }), expense({ amount: 50, is_reimbursement: true })];
        expect(totalSpent(expenses, 'EUR', {})).toBe(70);
    });
});

describe('frozen exchange rates', () => {
    const rates = { usd: 2 }; // today: 1 EUR = 2 USD

    it('uses the rate stored at the expense date', () => {
        expect(toKimpayAmount({ amount: 100, currency: 'USD', exchange_rate: 0.8 }, 'EUR', rates)).toBe(80);
    });

    it("falls back to today's rate when none is stored", () => {
        expect(toKimpayAmount({ amount: 100, currency: 'USD', exchange_rate: 0 }, 'EUR', rates)).toBe(50);
        expect(toKimpayAmount({ amount: 100, currency: 'USD' }, 'EUR', rates)).toBe(50);
    });

    it('ignores the rate for expenses in the Kimpay currency', () => {
        expect(toKimpayAmount({ amount: 100, currency: 'EUR', exchange_rate: 3 }, 'EUR', rates)).toBe(100);
    });

    it('drives the balances', () => {
        const e = expense({ amount: 100, currency: 'USD', exchange_rate: 0.9, involved: ['a', 'b'] });
        expect(calculateBalances([e], participants, 'EUR', rates)).toEqual({ a: 45, b: -45, c: 0 });
    });
});

describe('debts', () => {
    it('leaves a single cent alone', () => {
        // a is owed 0.01 by b: not worth a payment.
        const e = expense({ amount: 0.02, involved: ['a', 'b'] });
        expect(calculateDebts([e], participants)).toEqual([]);
    });
});

describe('new expense defaults', () => {
    it('ticks everyone, split equally, by default', () => {
        expect(newExpenseDefaults([{ id: 'a' }, { id: 'b' }])).toEqual({ involved: ['a', 'b'], split: { mode: 'equal' } });
    });

    it('leaves out the members no longer taking part, unless nobody is', () => {
        expect(newExpenseDefaults([{ id: 'a' }, { id: 'b', inactive: true }]).involved).toEqual(['a']);
        expect(newExpenseDefaults([{ id: 'a', inactive: true }]).involved).toEqual(['a']);
    });

    it('splits by shares when someone counts for more than one', () => {
        const members = [{ id: 'a', default_shares: 2 }, { id: 'b', default_shares: 0 }, { id: 'c' }];
        expect(memberWeights(members)).toEqual({ a: 2, b: 1, c: 1 });
        expect(newExpenseDefaults(members)).toEqual({
            involved: ['a', 'b', 'c'],
            split: { mode: 'shares', values: { a: 2, b: 1, c: 1 } },
        });
        // Someone left: their shares do not count.
        expect(newExpenseDefaults([{ id: 'a', default_shares: 2, inactive: true }, { id: 'b' }, { id: 'c' }]).split).toEqual({ mode: 'equal' });
    });

    it('starts the other modes from the default shares', () => {
        expect(defaultSplitValues('percent', ['a', 'b'], 0, 'EUR', { a: 3, b: 1 })).toEqual({ a: 75, b: 25 });
        expect(defaultSplitValues('amounts', ['a', 'b'], 9, 'EUR', { a: 2 })).toEqual({ a: 6, b: 3 });
    });
});

describe('paidBy', () => {
    it('adds up what someone paid, less what they received, without reimbursements', () => {
        const list = [
            expense({ id: '1', amount: 30, payer: 'a' }),
            expense({ id: '2', amount: 10, payer: 'a', is_income: true }),
            expense({ id: '3', amount: 5, payer: 'a', is_reimbursement: true, involved: ['b'] }),
            expense({ id: '4', amount: 50, payer: 'b' }),
        ];
        expect(paidBy(list, 'a', 'EUR', {})).toBe(20);
        expect(paidBy(list, 'c', 'EUR', {})).toBe(0);
    });
});
