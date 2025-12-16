import { describe, it, expect } from 'vitest';
import { 
    asExpense, 
    asExpenses, 
    asParticipant, 
    asParticipants, 
    asKimpay, 
    asRecentKimpay 
} from '../../src/lib/types';
import type { RecordModel } from 'pocketbase';

function createMockRecord(overrides: Partial<RecordModel> = {}): RecordModel {
    return {
        id: 'test123',
        collectionId: 'collection123',
        collectionName: 'test',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        ...overrides
    };
}

describe('Type Conversion Functions', () => {
    describe('asExpense', () => {
        it('should convert RecordModel to Expense', () => {
            const record = createMockRecord({
                collectionName: 'expenses',
                amount: 100,
                description: 'Test',
                date: '2024-01-01',
                payer: 'payer123',
                involved: ['p1', 'p2'],
                kimpay: 'kimpay123',
                created_by: 'user123',
                is_reimbursement: false
            });

            const expense = asExpense(record);

            expect(expense.id).toBe('test123');
            expect(expense.amount).toBe(100);
            expect(expense.description).toBe('Test');
            expect(expense.involved).toEqual(['p1', 'p2']);
        });
    });

    describe('asExpenses', () => {
        it('should convert array of RecordModels to Expenses', () => {
            const records = [
                createMockRecord({ id: 'exp1', amount: 50 }),
                createMockRecord({ id: 'exp2', amount: 100 })
            ];

            const expenses = asExpenses(records);

            expect(expenses).toHaveLength(2);
            expect(expenses[0].id).toBe('exp1');
            expect(expenses[1].id).toBe('exp2');
        });

        it('should return empty array for empty input', () => {
            expect(asExpenses([])).toEqual([]);
        });
    });

    describe('asParticipant', () => {
        it('should convert RecordModel to Participant', () => {
            const record = createMockRecord({
                collectionName: 'participants',
                name: 'John Doe',
                kimpay: 'kimpay123',
                user: 'user456'
            });

            const participant = asParticipant(record);

            expect(participant.id).toBe('test123');
            expect(participant.name).toBe('John Doe');
            expect(participant.kimpay).toBe('kimpay123');
        });
    });

    describe('asParticipants', () => {
        it('should convert array of RecordModels to Participants', () => {
            const records = [
                createMockRecord({ id: 'p1', name: 'Alice' }),
                createMockRecord({ id: 'p2', name: 'Bob' })
            ];

            const participants = asParticipants(records);

            expect(participants).toHaveLength(2);
            expect(participants[0].id).toBe('p1');
            expect(participants[1].id).toBe('p2');
        });
    });

    describe('asKimpay', () => {
        it('should convert RecordModel to Kimpay', () => {
            const record = createMockRecord({
                collectionName: 'kimpays',
                name: 'Trip to Paris',
                icon: '✈️',
                invite_token: 'token123',
                created_by: 'user789'
            });

            const kimpay = asKimpay(record);

            expect(kimpay.id).toBe('test123');
            expect(kimpay.name).toBe('Trip to Paris');
            expect(kimpay.icon).toBe('✈️');
            expect(kimpay.invite_token).toBe('token123');
        });
    });

    describe('asRecentKimpay', () => {
        it('should convert RecordModel to RecentKimpay', () => {
            const record = createMockRecord({
                collectionName: 'kimpays',
                name: 'Weekend Trip',
                icon: '🏖️'
            });

            const recentKimpay = asRecentKimpay(record);

            expect(recentKimpay.id).toBe('test123');
            expect(recentKimpay.name).toBe('Weekend Trip');
            expect(recentKimpay.icon).toBe('🏖️');
        });
    });
});
