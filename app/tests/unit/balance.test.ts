import { describe, it, expect } from 'vitest';
import { calculateDebts, type Transaction } from '../../src/lib/balance';
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
