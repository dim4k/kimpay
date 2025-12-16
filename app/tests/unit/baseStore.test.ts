import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initListFromCache } from '../../src/lib/stores/baseStore';
import type { RecordModel } from 'pocketbase';

// Create a shared mock state that tests can modify
const mockOfflineState = { isOffline: false };

// Mock the offlineService
vi.mock('$lib/services/offline.svelte', () => ({
    offlineService: {
        get isOffline() { return mockOfflineState.isOffline; },
        withOfflineSupport: vi.fn()
    }
}));

// Mock pocketbase
vi.mock('$lib/pocketbase', () => ({
    pb: {
        collection: () => ({
            unsubscribe: vi.fn(),
            subscribe: vi.fn()
        })
    }
}));

// Mock storage service
vi.mock('$lib/services/storage', () => ({
    storageService: {
        getKimpayData: vi.fn()
    }
}));

describe('initListFromCache', () => {
    it('should return initialList and shouldSwitch=true when switching kimpays', () => {
        const result = initListFromCache(
            'old-kimpay',
            'new-kimpay',
            [{ id: '1', name: 'test' }],
            () => undefined
        );

        expect(result.shouldSwitch).toBe(true);
        expect(result.list).toEqual([{ id: '1', name: 'test' }]);
    });

    it('should return empty list when switching to new kimpay with no initial data', () => {
        const result = initListFromCache(
            'old-kimpay',
            'new-kimpay',
            [],
            () => [{ id: 'cached', name: 'cached item' }]
        );

        expect(result.shouldSwitch).toBe(true);
        expect(result.list).toEqual([]);
    });

    it('should return initialList when same kimpay and initialList provided', () => {
        const result = initListFromCache(
            'same-kimpay',
            'same-kimpay',
            [{ id: '1', name: 'new' }],
            () => [{ id: '2', name: 'cached' }]
        );

        expect(result.shouldSwitch).toBe(false);
        expect(result.list).toEqual([{ id: '1', name: 'new' }]);
    });

    it('should return cached data when same kimpay and no initialList', () => {
        const cachedData = [{ id: '2', name: 'cached' }];
        const result = initListFromCache(
            'same-kimpay',
            'same-kimpay',
            [],
            () => cachedData
        );

        expect(result.shouldSwitch).toBe(false);
        expect(result.list).toEqual(cachedData);
    });

    it('should return empty initialList when same kimpay, no initialList, and no cache', () => {
        const result = initListFromCache(
            'same-kimpay',
            'same-kimpay',
            [],
            () => undefined
        );

        expect(result.shouldSwitch).toBe(false);
        expect(result.list).toEqual([]);
    });

    it('should return empty list when cache returns empty array', () => {
        const result = initListFromCache(
            'same-kimpay',
            'same-kimpay',
            [],
            () => []
        );

        expect(result.shouldSwitch).toBe(false);
        expect(result.list).toEqual([]);
    });

    it('should handle null currentKimpayId (first init)', () => {
        const result = initListFromCache(
            null,
            'new-kimpay',
            [{ id: '1', name: 'first' }],
            () => undefined
        );

        expect(result.shouldSwitch).toBe(true);
        expect(result.list).toEqual([{ id: '1', name: 'first' }]);
    });
});

describe('createSubscriptionHandler', () => {
    // Import dynamically after mocks are set up
    let createSubscriptionHandler: typeof import('../../src/lib/stores/baseStore').createSubscriptionHandler;

    interface TestItem {
        id: string;
        name: string;
    }

    const createMockRecord = (overrides: Partial<RecordModel> = {}): RecordModel => ({
        id: 'test-id',
        collectionId: 'test-collection',
        collectionName: 'test',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        kimpay: 'test-kimpay',
        ...overrides
    });

    let list: TestItem[];
    let setListMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        // Reset mocks
        vi.clearAllMocks();
        mockOfflineState.isOffline = false;
        
        list = [];
        setListMock = vi.fn((items: TestItem[]) => { list = items; });
        
        // Import the function after mocks are applied
        const module = await import('../../src/lib/stores/baseStore');
        createSubscriptionHandler = module.createSubscriptionHandler;
    });

    it('should add item on create action', async () => {
        const handler = createSubscriptionHandler<TestItem>('test-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock
        });

        await handler({
            action: 'create',
            record: createMockRecord({ id: 'new-1', name: 'New Item' })
        });

        expect(setListMock).toHaveBeenCalledWith([{ id: 'new-1', name: 'New Item' }]);
    });

    it('should not add duplicate item on create', async () => {
        list = [{ id: 'existing-1', name: 'Existing' }];

        const handler = createSubscriptionHandler<TestItem>('test-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock
        });

        await handler({
            action: 'create',
            record: createMockRecord({ id: 'existing-1', name: 'Duplicate' })
        });

        expect(setListMock).not.toHaveBeenCalled();
    });

    it('should update item on update action', async () => {
        list = [{ id: 'item-1', name: 'Original' }];

        const handler = createSubscriptionHandler<TestItem>('test-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock
        });

        await handler({
            action: 'update',
            record: createMockRecord({ id: 'item-1', name: 'Updated' })
        });

        expect(setListMock).toHaveBeenCalledWith([{ id: 'item-1', name: 'Updated' }]);
    });

    it('should remove item on delete action', async () => {
        list = [
            { id: 'item-1', name: 'First' },
            { id: 'item-2', name: 'Second' }
        ];

        const handler = createSubscriptionHandler<TestItem>('test-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock
        });

        await handler({
            action: 'delete',
            record: createMockRecord({ id: 'item-1', name: 'First' })
        });

        expect(setListMock).toHaveBeenCalledWith([{ id: 'item-2', name: 'Second' }]);
    });

    it('should ignore events from different kimpay', async () => {
        const handler = createSubscriptionHandler<TestItem>('my-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock
        });

        await handler({
            action: 'create',
            record: createMockRecord({ kimpay: 'other-kimpay', id: 'new-1' })
        });

        expect(setListMock).not.toHaveBeenCalled();
    });

    it('should ignore events when offline', async () => {
        mockOfflineState.isOffline = true;

        const handler = createSubscriptionHandler<TestItem>('test-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock
        });

        await handler({
            action: 'create',
            record: createMockRecord({ id: 'new-1' })
        });

        expect(setListMock).not.toHaveBeenCalled();
    });

    it('should apply sortItems function when provided', async () => {
        list = [{ id: 'b', name: 'B' }];

        const handler = createSubscriptionHandler<TestItem>('test-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock,
            sortItems: (items) => [...items].sort((a, b) => a.id.localeCompare(b.id))
        });

        await handler({
            action: 'create',
            record: createMockRecord({ id: 'a', name: 'A' })
        });

        expect(setListMock).toHaveBeenCalledWith([
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' }
        ]);
    });

    it('should use fetchExpanded when provided', async () => {
        const fetchExpanded = vi.fn().mockResolvedValue({ id: 'fetched-1', name: 'Fetched' });

        const handler = createSubscriptionHandler<TestItem>('test-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock,
            fetchExpanded
        });

        await handler({
            action: 'create',
            record: createMockRecord({ id: 'fetched-1', name: 'Original' })
        });

        expect(fetchExpanded).toHaveBeenCalledWith('fetched-1');
        expect(setListMock).toHaveBeenCalledWith([{ id: 'fetched-1', name: 'Fetched' }]);
    });

    it('should fallback to convertRecord when fetchExpanded fails', async () => {
        const fetchExpanded = vi.fn().mockRejectedValue(new Error('Network error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const handler = createSubscriptionHandler<TestItem>('test-kimpay', {
            convertRecord: (r) => ({ id: r.id, name: r['name'] as string }),
            getList: () => list,
            setList: setListMock,
            fetchExpanded
        });

        await handler({
            action: 'create',
            record: createMockRecord({ id: 'fallback-1', name: 'Fallback' })
        });

        expect(consoleSpy).toHaveBeenCalled();
        expect(setListMock).toHaveBeenCalledWith([{ id: 'fallback-1', name: 'Fallback' }]);
        
        consoleSpy.mockRestore();
    });
});
