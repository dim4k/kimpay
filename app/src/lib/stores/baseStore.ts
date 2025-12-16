import { pb } from "$lib/pocketbase";
import { storageService } from "$lib/services/storage";
import { offlineService } from "$lib/services/offline.svelte";
import type { RecordModel } from "pocketbase";
import type { Kimpay } from "$lib/types";

// =============================================================================
// Store Utilities
// =============================================================================
// Composable utility functions for common store patterns.
// These reduce code duplication while preserving each store's unique behavior.

/**
 * Initialize list state with cache-first strategy.
 * Returns the initial list to use.
 */
export function initListFromCache<T>(
    currentKimpayId: string | null,
    newKimpayId: string,
    initialList: T[],
    getCached: () => T[] | undefined
): { list: T[]; shouldSwitch: boolean } {
    const shouldSwitch = currentKimpayId !== newKimpayId;
    
    // console.log(`[BaseStore] initListFromCache: Current=${currentKimpayId}, New=${newKimpayId}, ShouldSwitch=${shouldSwitch}, InitListLen=${initialList.length}`);

    // If switching kimpays, use initialList (may be empty to clear stale data)
    if (shouldSwitch) {
        return { list: initialList, shouldSwitch };
    }
    
    // Same kimpay - only update if list provided
    if (initialList.length > 0) {
        return { list: initialList, shouldSwitch };
    }
    
    // Try to load from cache
    const cached = getCached();
    if (cached && cached.length > 0) {
        return { list: cached, shouldSwitch };
    }
    
    return { list: initialList, shouldSwitch };
}

/**
 * Get cached Kimpay data from local storage.
 */
export function getCachedKimpay(kimpayId: string): Kimpay | null {
    return storageService.getKimpayData(kimpayId);
}

/**
 * Execute an action with offline fallback support.
 * Wraps offlineService.withOfflineSupport with clearer typing.
 */
export async function withOfflineFallback<T>(
    onlineAction: () => Promise<T>,
    offlineAction: () => T | Promise<T>
): Promise<T> {
    return offlineService.withOfflineSupport(onlineAction, offlineAction);
}

/**
 * Create a subscription handler for PocketBase realtime events.
 * Returns an async function suitable for pb.collection().subscribe().
 */
export function createSubscriptionHandler<T extends { id: string }>(
    kimpayId: string,
    options: {
        convertRecord: (record: RecordModel) => T;
        getList: () => T[];
        setList: (items: T[]) => void;
        sortItems?: (items: T[]) => T[];
        fetchExpanded?: (id: string) => Promise<T | null>;
    }
) {
    const { convertRecord, getList, setList, sortItems = (x) => x, fetchExpanded } = options;
    
    return async (e: { action: string; record: RecordModel }) => {
        if (e.record.kimpay !== kimpayId) return;
        if (offlineService.isOffline) return;
        
        // Get the item (either fetch expanded or convert directly)
        let item: T | null;
        if (fetchExpanded && e.action !== 'delete') {
            try {
                item = await fetchExpanded(e.record.id);
            } catch (err) {
                console.error(`Failed to fetch expanded record ${e.record.id}`, err);
                item = convertRecord(e.record);
            }
        } else {
            item = convertRecord(e.record);
        }
        
        if (!item) return;
        
        const list = getList();
        
        if (e.action === "create") {
            if (!list.some(x => x.id === item!.id)) {
                setList(sortItems([...list, item]));
            }
        } else if (e.action === "update") {
            setList(sortItems(list.map(x => x.id === item!.id ? item! : x)));
        } else if (e.action === "delete") {
            setList(list.filter(x => x.id !== item!.id));
        }
    };
}

/**
 * Subscribe to a collection with automatic unsubscribe handling.
 */
export async function subscribeToCollection(
    collectionName: string,
    handler: (e: { action: string; record: RecordModel }) => Promise<void>
): Promise<void> {
    // Unsubscribe from previous to prevent duplication
    await pb.collection(collectionName).unsubscribe("*");
    await pb.collection(collectionName).subscribe("*", handler);
}

/**
 * Unsubscribe from a collection.
 */
export async function unsubscribeFromCollection(collectionName: string): Promise<void> {
    await pb.collection(collectionName).unsubscribe("*");
}
