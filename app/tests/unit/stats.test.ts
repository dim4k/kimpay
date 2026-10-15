import { describe, it, expect } from 'vitest';
import { categoryDetail, groupStats, spendingByCategory } from '../../src/lib/stats';
import type { Expense } from '../../src/lib/types';

function expense(over: Partial<Expense>): Expense {
    return {
        id: Math.random().toString(36).slice(2),
        collectionId: 'expenses',
        collectionName: 'expenses',
        created: '2026-09-17T10:00:00Z',
        updated: '2026-09-17T10:00:00Z',
        amount: 10,
        description: 'Expense',
        currency: 'EUR',
        date: '2026-09-17 12:00:00.000Z',
        payer: 'a',
        involved: ['a', 'b'],
        kimpay: 'k',
        created_by: 'a',
        is_reimbursement: false,
        ...over,
    };
}

const ids = ['a', 'b', 'c'];

describe('spendingByCategory', () => {
    const expenses = [
        expense({ icon: '🍝', amount: 30, involved: ['a', 'b', 'c'] }),
        expense({ icon: '🚗', amount: 50, involved: ['b', 'c'] }),
        expense({ icon: '🍕', amount: 12, involved: ['a', 'b'] }),
        expense({ amount: 100, is_reimbursement: true, payer: 'b', involved: ['a'] }),
    ];

    it('adds up the group spending per category, biggest first, without reimbursements', () => {
        expect(spendingByCategory(expenses, 'EUR', {}, ids)).toEqual([
            { key: 'TRANSPORT', amount: 50 },
            { key: 'FOOD', amount: 42 },
        ]);
    });

    it('counts only my part for me', () => {
        expect(spendingByCategory(expenses, 'EUR', {}, ids, 'a')).toEqual([{ key: 'FOOD', amount: 16 }]);
    });

    it('takes money received off its category', () => {
        const withIncome = [...expenses, expense({ icon: '🍕', amount: 42, is_income: true, involved: ['a', 'b', 'c'] })];
        expect(spendingByCategory(withIncome, 'EUR', {}, ids)).toEqual([{ key: 'TRANSPORT', amount: 50 }]);
    });

    it('converts other currencies with the rate of the expense', () => {
        const usd = [expense({ icon: '🚗', amount: 20, currency: 'USD', exchange_rate: 0.5 })];
        expect(spendingByCategory(usd, 'EUR', {}, ids)).toEqual([{ key: 'TRANSPORT', amount: 10 }]);
    });
});

describe('categoryDetail', () => {
    const expenses = [
        expense({ icon: '🍝', amount: 30, involved: ['a', 'b', 'c'], description: 'Pasta' }),
        expense({ icon: '🍕', amount: 12, involved: ['a', 'b'], description: 'Pizza' }),
        expense({ icon: '🍔', amount: 20, involved: ['b'], description: 'Burger' }),
        expense({ icon: '🥐', amount: 3, involved: ['a'], description: 'Croissant' }),
        expense({ icon: '🍕', amount: 6, is_income: true, involved: ['a', 'b', 'c'], description: 'Refund' }),
        expense({ icon: '🚗', amount: 50, involved: ['b', 'c'] }),
        expense({ icon: '🍕', amount: 100, is_reimbursement: true, payer: 'b', involved: ['a'] }),
    ];

    it('sums the category as the list shows it: money received off, never reimbursements', () => {
        const detail = categoryDetail(expenses, 'FOOD', 'EUR', {}, ids, 'a');
        expect(detail.count).toBe(5);
        expect(detail.total).toBe(59);
        // 10 + 6 + 0 + 3, minus 2 received
        expect(detail.mine).toBe(17);
    });

    it('keeps the three biggest expenses, not money received', () => {
        const detail = categoryDetail(expenses, 'FOOD', 'EUR', {}, ids);
        expect(detail.biggest.map((b) => [b.expense.description, b.amount])).toEqual([
            ['Pasta', 30],
            ['Burger', 20],
            ['Pizza', 12],
        ]);
        expect(detail.mine).toBe(0);
    });

    it('converts other currencies with the rate of the expense', () => {
        const usd = [expense({ icon: '🚗', amount: 20, currency: 'USD', exchange_rate: 0.5 })];
        expect(categoryDetail(usd, 'TRANSPORT', 'EUR', {}, ids).biggest[0]!.amount).toBe(10);
    });
});

describe('groupStats', () => {
    it('sums up the group', () => {
        const stats = groupStats([
            expense({ amount: 60, payer: 'a', date: '2026-09-17 12:00:00.000Z', description: 'Moules' }),
            expense({ amount: 170, payer: 'b', date: '2026-09-19 12:00:00.000Z', description: 'Essence' }),
            expense({ amount: 30, payer: 'b', date: '2026-09-20 12:00:00.000Z', is_income: true }),
            expense({ amount: 40, payer: 'c', date: '2026-09-24 12:00:00.000Z', is_reimbursement: true }),
        ], 'EUR', {});
        expect(stats.days).toBe(4); // 17 to 20 September; reimbursements do not count
        expect(stats.perDay).toBe(50); // (60 + 170 - 30) / 4
        expect(stats.biggest?.description).toBe('Essence');
        expect(stats.biggestAmount).toBe(170);
        expect(stats.topPayer).toEqual({ id: 'b', amount: 170 });
        expect(stats.expenseCount).toBe(3);
        expect(stats.reimbursementCount).toBe(1);
    });

    it('stays empty without expenses', () => {
        expect(groupStats([], 'EUR', {})).toMatchObject({ days: 0, perDay: 0, biggest: null, topPayer: null, expenseCount: 0 });
    });
});
