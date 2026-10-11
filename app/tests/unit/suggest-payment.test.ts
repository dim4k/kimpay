import { describe, it, expect } from 'vitest';
import { findSimilarExpense, merchantKey } from '../../src/lib/utils/suggest';
import { normalizeHandle, paymentLinks } from '../../src/lib/utils/payment';
import { objectToFormData } from '../../src/lib/utils/formData';
import type { Expense } from '../../src/lib/types';

const expense = (overrides: Partial<Expense>): Expense => ({
    id: 'e1',
    collectionId: 'expenses',
    collectionName: 'expenses',
    created: '2026-01-01',
    updated: '',
    amount: 10,
    description: 'Test',
    date: '2026-01-15 00:00:00.000Z',
    payer: 'a',
    involved: ['a'],
    kimpay: 'k',
    created_by: 'a',
    is_reimbursement: false,
    currency: 'EUR',
    ...overrides,
});

describe('utils/suggest', () => {
    it('keys on the merchant, ignoring case and accents', () => {
        expect(merchantKey('Café Lumière - Restaurant')).toBe('cafe lumiere');
        expect(merchantKey('  Carrefour  ')).toBe('carrefour');
    });

    it('finds the latest expense from the same merchant', () => {
        const expenses = [
            expense({ id: 'old', description: 'Carrefour - Courses', date: '2026-01-01' }),
            expense({ id: 'new', description: 'carrefour - groceries', date: '2026-02-01' }),
            expense({ id: 'other', description: 'Lidl - Courses', date: '2026-03-01' }),
        ];
        expect(findSimilarExpense(expenses, 'CARREFOUR - Supermarché')?.id).toBe('new');
    });

    it('skips reimbursements and money received', () => {
        const expenses = [
            expense({ description: 'Carrefour', is_reimbursement: true }),
            expense({ description: 'Carrefour', is_income: true }),
        ];
        expect(findSimilarExpense(expenses, 'Carrefour')).toBeNull();
        expect(findSimilarExpense(expenses, 'X')).toBeNull();
    });
});

describe('utils/payment', () => {
    it('extracts the handle from links and @names', () => {
        expect(normalizeHandle('https://www.paypal.me/alice.b/10')).toBe('alice.b');
        expect(normalizeHandle('revolut.me/bob?x=1')).toBe('bob');
        expect(normalizeHandle('@carol')).toBe('carol');
        expect(normalizeHandle('  ')).toBe('');
        expect(normalizeHandle('not valid!')).toBeNull();
    });

    it('builds PayPal links with the amount, Revolut links without', () => {
        const links = paymentLinks({ paypal: 'alice', revolut: 'alice_r' }, 12.5, 'eur');
        expect(links.map((l) => l.url)).toEqual(['https://paypal.me/alice/12.50EUR', 'https://revolut.me/alice_r']);
        expect(paymentLinks({ paypal: 'bad handle' }, 1, 'EUR')).toEqual([]);
        expect(paymentLinks(undefined, 1, 'EUR')).toEqual([]);
    });
});

describe('utils/formData', () => {
    it('sends objects as JSON and keeps files as is', () => {
        const file = new Blob(['x']);
        const data = objectToFormData({ split: { mode: 'shares', values: { a: 2 } }, involved: ['a', 'b'], photo: file, skip: null });
        expect(data.get('split')).toBe('{"mode":"shares","values":{"a":2}}');
        expect(data.getAll('involved')).toEqual(['a', 'b']);
        expect(data.get('photo')).toBeInstanceOf(Blob);
        expect(data.has('skip')).toBe(false);
    });
});
