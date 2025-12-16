import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageService, type PendingAction } from '../../src/lib/services/storage';
import type { Kimpay } from '../../src/lib/types';

// Mock localStorage
const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    };
})();

// Set up localStorage mock before each test
beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true
    });
});

function createMockKimpay(id: string): Kimpay {
    return {
        id,
        collectionId: 'kimpays',
        collectionName: 'kimpays',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        name: 'Test Kimpay',
        created_by: 'user123'
    };
}

function createMockPendingAction(id: string, type: PendingAction['type'] = 'CREATE_EXPENSE'): PendingAction {
    return {
        id,
        type,
        payload: { description: 'Test', amount: 50 },
        timestamp: Date.now(),
        kimpayId: 'kimpay123'
    };
}

describe('storageService', () => {
    describe('saveKimpayData / getKimpayData', () => {
        it('should save and retrieve kimpay data', () => {
            const kimpay = createMockKimpay('test123');
            
            storageService.saveKimpayData('test123', kimpay);
            const retrieved = storageService.getKimpayData('test123');
            
            expect(retrieved).toEqual(kimpay);
        });

        it('should return null for non-existent kimpay', () => {
            const result = storageService.getKimpayData('nonexistent');
            expect(result).toBeNull();
        });

        it('should handle JSON parse errors gracefully', () => {
            // Suppress expected console.error
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            mockLocalStorage.setItem('kimpay_data_corrupt', 'invalid json');
            const result = storageService.getKimpayData('corrupt');
            
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });

    describe('hasKimpayData', () => {
        it('should return true when data exists', () => {
            const kimpay = createMockKimpay('exists');
            storageService.saveKimpayData('exists', kimpay);
            
            expect(storageService.hasKimpayData('exists')).toBe(true);
        });

        it('should return false when data does not exist', () => {
            expect(storageService.hasKimpayData('nonexistent')).toBe(false);
        });
    });

    describe('Pending Actions Queue', () => {
        it('should save and retrieve pending actions', () => {
            const action = createMockPendingAction('action1');
            
            storageService.savePendingAction(action);
            const actions = storageService.getPendingActions();
            
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual(action);
        });

        it('should queue multiple actions', () => {
            storageService.savePendingAction(createMockPendingAction('action1'));
            storageService.savePendingAction(createMockPendingAction('action2'));
            storageService.savePendingAction(createMockPendingAction('action3'));
            
            const actions = storageService.getPendingActions();
            expect(actions).toHaveLength(3);
        });

        it('should remove specific action from queue', () => {
            storageService.savePendingAction(createMockPendingAction('action1'));
            storageService.savePendingAction(createMockPendingAction('action2'));
            
            storageService.removePendingAction('action1');
            
            const actions = storageService.getPendingActions();
            expect(actions).toHaveLength(1);
            expect(actions[0].id).toBe('action2');
        });

        it('should clear entire queue', () => {
            storageService.savePendingAction(createMockPendingAction('action1'));
            storageService.savePendingAction(createMockPendingAction('action2'));
            
            storageService.clearQueue();
            
            expect(storageService.getPendingActions()).toEqual([]);
        });

        it('should return empty array when queue is empty', () => {
            expect(storageService.getPendingActions()).toEqual([]);
        });
    });

    describe('Recent Kimpays & Identity', () => {
        it('should save and retrieve participant id for kimpay', () => {
            storageService.setMyParticipantId('kimpay123', 'participant456');
            
            const participantId = storageService.getMyParticipantId('kimpay123');
            expect(participantId).toBe('participant456');
        });

        it('should return null for unknown kimpay participant', () => {
            expect(storageService.getMyParticipantId('unknown')).toBeNull();
        });

        it('should get list of recent kimpay IDs', () => {
            storageService.setMyParticipantId('abc123def456ghi', 'p1');
            storageService.setMyParticipantId('xyz789abc123def', 'p2');
            
            const ids = storageService.getRecentKimpayIds();
            expect(ids).toContain('abc123def456ghi');
            expect(ids).toContain('xyz789abc123def');
        });

        it('should filter out invalid kimpay IDs', () => {
            // Manually set invalid data
            mockLocalStorage.setItem('my_kimpays', JSON.stringify({
                'abc123def456ghi': 'p1', // valid (15 chars)
                'invalid': 'p2',          // invalid (too short)
                '': 'p3'                  // invalid (empty)
            }));
            
            const ids = storageService.getRecentKimpayIds();
            expect(ids).toEqual(['abc123def456ghi']);
        });

        it('should remove recent kimpay', () => {
            storageService.setMyParticipantId('kimpay1', 'p1');
            storageService.setMyParticipantId('kimpay2', 'p2');
            
            storageService.removeRecentKimpay('kimpay1');
            
            expect(storageService.getMyParticipantId('kimpay1')).toBeNull();
            expect(storageService.getMyParticipantId('kimpay2')).toBe('p2');
        });
    });
});
