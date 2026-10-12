import { describe, it, expect } from 'vitest';
import { calculateBalances, calculateDebts, expenseImpact, expenseShare, shareOf, type Transaction } from '../../src/lib/balance';
import type { Expense, Participant } from '../../src/lib/types';

function createParticipant(id: string, name: string): Participant {
    return {
        id,
        collectionId: 'participants',
        collectionName: 'participants',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        name,
        kimpay: 'test-kimpay'
    };
}

function createExpense(
    id: string,
    amount: number,
    payerId: string,
    involvedIds: string[]
): Expense {
    return {
        id,
        collectionId: 'expenses',
        collectionName: 'expenses',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        amount,
        description: 'Test expense',
        currency: 'EUR',
        date: new Date().toISOString(),
        payer: payerId,
        involved: involvedIds,
        kimpay: 'test-kimpay',
        created_by: payerId,
        is_reimbursement: false
    };
}

describe('calculateDebts', () => {
    it('should return empty array when no expenses', () => {
        const participants = [
            createParticipant('a', 'Alice'),
            createParticipant('b', 'Bob')
        ];
        
        const result = calculateDebts([], participants);
        
        expect(result).toEqual([]);
    });

    it('should return empty array when expenses are balanced', () => {
        const participants = [
            createParticipant('a', 'Alice'),
            createParticipant('b', 'Bob')
        ];
        const expenses = [
            createExpense('1', 50, 'a', ['a', 'b']),
            createExpense('2', 50, 'b', ['a', 'b'])
        ];
        
        const result = calculateDebts(expenses, participants);
        
        expect(result).toEqual([]);
    });

    it('should calculate simple two-person debt', () => {
        const participants = [
            createParticipant('a', 'Alice'),
            createParticipant('b', 'Bob')
        ];
        const expenses = [
            createExpense('1', 100, 'a', ['a', 'b'])
        ];
        
        const result = calculateDebts(expenses, participants);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual<Transaction>({
            from: 'b',
            to: 'a',
            amount: 50,
            currency: 'EUR'
        });
    });

    it('should calculate debt with three participants', () => {
        const participants = [
            createParticipant('a', 'Alice'),
            createParticipant('b', 'Bob'),
            createParticipant('c', 'Charlie')
        ];
        const expenses = [
            createExpense('1', 90, 'a', ['a', 'b', 'c'])
        ];
        
        const result = calculateDebts(expenses, participants);
        
        // Alice paid 90, each owes 30, so Alice is owed 60 total (30 from Bob, 30 from Charlie)
        expect(result).toHaveLength(2);
        
        const totalOwedToAlice = result
            .filter(t => t.to === 'a')
            .reduce((sum, t) => sum + t.amount, 0);
        
        expect(totalOwedToAlice).toBe(60);
    });

    it('should minimize transactions with multiple payers', () => {
        const participants = [
            createParticipant('a', 'Alice'),
            createParticipant('b', 'Bob'),
            createParticipant('c', 'Charlie')
        ];
        const expenses = [
            createExpense('1', 60, 'a', ['a', 'b', 'c']), // Alice pays 60
            createExpense('2', 30, 'b', ['a', 'b', 'c'])  // Bob pays 30
        ];
        
        // Total: 90, each should pay 30
        // Alice paid 60, owes 30, net: +30
        // Bob paid 30, owes 30, net: 0
        // Charlie paid 0, owes 30, net: -30
        
        const result = calculateDebts(expenses, participants);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual<Transaction>({
            from: 'c',
            to: 'a',
            amount: 30,
            currency: 'EUR'
        });
    });

    it('should handle partial involvement', () => {
        const participants = [
            createParticipant('a', 'Alice'),
            createParticipant('b', 'Bob'),
            createParticipant('c', 'Charlie')
        ];
        const expenses = [
            createExpense('1', 100, 'a', ['a', 'b']) // Only Alice and Bob
        ];
        
        const result = calculateDebts(expenses, participants);
        
        // Alice paid 100 for herself and Bob (50 each)
        // Bob owes Alice 50
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual<Transaction>({
            from: 'b',
            to: 'a',
            amount: 50,
            currency: 'EUR'
        });
    });

    it('should handle decimal amounts correctly', () => {
        const participants = [
            createParticipant('a', 'Alice'),
            createParticipant('b', 'Bob'),
            createParticipant('c', 'Charlie')
        ];
        const expenses = [
            createExpense('1', 100, 'a', ['a', 'b', 'c']) // 33.33 each
        ];
        
        const result = calculateDebts(expenses, participants);
        
        // Each participant should owe 33.33, Alice is owed 66.67
        const totalOwed = result.reduce((sum, t) => sum + t.amount, 0);
        expect(totalOwed).toBeCloseTo(66.67, 1);
    });

    it('should handle empty involved array by including everyone', () => {
        const participants = [
            createParticipant('a', 'Alice'),
            createParticipant('b', 'Bob')
        ];
        const expenses: Expense[] = [{
            id: '1',
            currency: 'EUR',
            collectionId: 'expenses',
            collectionName: 'expenses',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            amount: 100,
            description: 'Test',
            date: new Date().toISOString(),
            payer: 'a',
            involved: [], // Empty = everyone
            kimpay: 'test-kimpay',
            created_by: 'a',
            is_reimbursement: false
        }];
        
        const result = calculateDebts(expenses, participants);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual<Transaction>({
            from: 'b',
            to: 'a',
            amount: 50,
            currency: 'EUR'
        });
    });
});

describe('expenseShare', () => {
    const ids = ['a', 'b', 'c', 'd'];

    it('is an equal part of the amount', () => {
        expect(expenseShare(createExpense('1', 120, 'a', ids), 'a', ids)).toBe(30);
        expect(expenseShare(createExpense('1', 120, 'a', ids), 'b', ids)).toBe(30);
    });

    it('is 0 for the payer when they are not involved', () => {
        expect(expenseShare(createExpense('1', 50, 'a', ['b', 'c']), 'a', ids)).toBe(0);
        expect(expenseShare(createExpense('1', 50, 'a', ['b', 'c']), 'b', ids)).toBe(25);
    });

    it('splits cents without losing any', () => {
        const expense = createExpense('1', 10, 'a', ['a', 'b', 'c']);
        const total = ['a', 'b', 'c'].reduce((sum, id) => sum + expenseShare(expense, id, ids), 0);
        expect(total).toBeCloseTo(10, 10);
    });

    it('follows a custom split', () => {
        const expense = { ...createExpense('1', 100, 'a', ['a', 'b']), split: { mode: 'shares' as const, values: { a: 3, b: 1 } } };
        expect(expenseShare(expense, 'a', ids)).toBe(75);
        expect(expenseShare(expense, 'b', ids)).toBe(25);
    });

    it('is 0 for reimbursements', () => {
        const refund = { ...createExpense('1', 20, 'd', ['a']), is_reimbursement: true };
        expect(expenseShare(refund, 'a', ids)).toBe(0);
    });
});

describe('shareOf', () => {
    const participants = ['a', 'b', 'c', 'd'].map((id) => createParticipant(id, id));
    const ids = participants.map((p) => p.id);

    it('adds up the shares, minus money received, without reimbursements', () => {
        const expenses = [
            createExpense('1', 24, 'a', ids),
            createExpense('2', 360, 'b', ids),
            { ...createExpense('3', 40, 'c', ['a', 'c']), is_income: true },
            { ...createExpense('4', 20, 'd', ['a']), is_reimbursement: true },
        ];
        expect(shareOf(expenses, participants, 'a', 'EUR', {})).toBe(6 + 90 - 20);
    });
});

describe('calculateBalances', () => {
    const refund = (id: string, amount: number, from: string, to: string): Expense =>
        ({ ...createExpense(id, amount, from, [to]), is_reimbursement: true });

    it('shows a group settled with the former rounding as settled', () => {
        // 183 € for 7 people (26.142857... each), settled with the payments
        // the app suggested before shares were counted in cents: 6 x 26.14.
        const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        const participants = ids.map((id) => createParticipant(id, id));
        const expenses = [
            createExpense('1', 183, 'a', ids),
            ...ids.slice(1).map((id, i) => refund(`r${i}`, 26.14, id, 'a')),
        ];
        expect(Object.values(calculateBalances(expenses, participants))).toEqual(ids.map(() => 0));
        expect(calculateDebts(expenses, participants)).toEqual([]);
    });

    it('does not pile the indivisible cents up on the same person', () => {
        const participants = ['a', 'b', 'c'].map((id) => createParticipant(id, id));
        const expenses = Array.from({ length: 10 }, (_, i) => createExpense(String(i), 10, 'c', ['a', 'b', 'c']));
        const balances = calculateBalances(expenses, participants);
        expect(Math.round(Math.abs(balances.a! - balances.b!) * 100)).toBeLessThanOrEqual(1);
        expect(balances.a! + balances.b! + balances.c!).toBeCloseTo(0, 10);
    });

    it('keeps balances in whole cents adding up to 0', () => {
        const participants = ['a', 'b', 'c'].map((id) => createParticipant(id, id));
        const balances = calculateBalances([createExpense('1', 10, 'a', ['a', 'b', 'c'])], participants);
        expect(balances).toEqual({ a: 6.67, b: -3.33, c: -3.34 });
    });
});

describe('expenseImpact', () => {
    const ids = ['a', 'b', 'c'];

    it('is what I advanced for the others when I paid', () => {
        expect(expenseImpact(createExpense('1', 90, 'a', ids), 'a', ids)).toBe(60);
    });

    it('is minus my share when someone else paid', () => {
        expect(expenseImpact(createExpense('1', 90, 'a', ids), 'b', ids)).toBe(-30);
    });

    it('is the whole amount when I paid for the others only', () => {
        expect(expenseImpact(createExpense('1', 50, 'a', ['b', 'c']), 'a', ids)).toBe(50);
    });

    it('works the other way round for money received', () => {
        const income = { ...createExpense('1', 60, 'a', ids), is_income: true };
        expect(expenseImpact(income, 'a', ids)).toBe(-40);
        expect(expenseImpact(income, 'b', ids)).toBe(20);
    });

    it('does not concern someone neither paying nor involved', () => {
        expect(expenseImpact(createExpense('1', 50, 'a', ['a', 'b']), 'c', ids)).toBeUndefined();
    });

    it('says nothing for reimbursements', () => {
        const reimbursement = { ...createExpense('1', 20, 'a', ['b']), is_reimbursement: true };
        expect(expenseImpact(reimbursement, 'a', ids)).toBeNull();
    });
});

describe('settled amounts', () => {
    it('counts less than half a cent as settled', async () => {
        const { isSettled } = await import('../../src/lib/balance');
        expect(isSettled(0)).toBe(true);
        expect(isSettled(0.004)).toBe(true);
        expect(isSettled(-0.004)).toBe(true);
        expect(isSettled(0.01)).toBe(false);
        expect(isSettled(-12.5)).toBe(false);
    });

    it('gives the tone and sign of a balance', async () => {
        const { balanceTone, balanceSign } = await import('../../src/lib/balance');
        expect(balanceTone(12)).toBe('success');
        expect(balanceTone(-12)).toBe('warning');
        expect(balanceTone(0.001)).toBe('neutral');
        expect(balanceSign(12)).toBe('+');
        expect(balanceSign(-12)).toBe('−');
        expect(balanceSign(-0.001)).toBe('');
    });
});
