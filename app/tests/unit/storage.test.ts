import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    storageService,
    type PendingAction,
} from "../../src/lib/services/storage";
import type { Kimpay } from "../../src/lib/types";

// Mock idb-keyval
const mockStore: Record<string, unknown> = {};

vi.mock("idb-keyval", () => ({
    get: vi.fn((key: string) => Promise.resolve(mockStore[key])),
    set: vi.fn((key: string, value: unknown) => {
        mockStore[key] = value;
        return Promise.resolve();
    }),
    del: vi.fn((key: string) => {
        delete mockStore[key];
        return Promise.resolve();
    }),
    keys: vi.fn(() => Promise.resolve(Object.keys(mockStore))),
    clear: vi.fn(() => {
        for (const key in mockStore) delete mockStore[key];
        return Promise.resolve();
    }),
}));

// Set up mocks before each test
beforeEach(() => {
    for (const key in mockStore) delete mockStore[key];
    vi.clearAllMocks();
});

function createMockKimpay(id: string, myParticipantId?: string): Kimpay {
    return {
        id,
        collectionId: "kimpays",
        collectionName: "kimpays",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        name: "Test Kimpay",
        created_by: "user123",
        myParticipantId,
    };
}

function createMockPendingAction(
    id: string,
    type: PendingAction["type"] = "CREATE_EXPENSE"
): PendingAction {
    return {
        id,
        type,
        payload: { description: "Test", amount: 50 },
        timestamp: Date.now(),
        kimpayId: "kimpay123",
    };
}

describe("Storage Service", () => {
    describe("Kimpay Data", () => {
        it("should save and retrieve kimpay data", async () => {
            const kimpay = createMockKimpay("123");
            await storageService.saveKimpayData("123", kimpay);

            const retrieved = await storageService.getKimpayData("123");
            expect(retrieved).toEqual(kimpay);
        });

        it("should return null for non-existent kimpay data", async () => {
            const retrieved = await storageService.getKimpayData("nonexistent");
            expect(retrieved).toBeNull();
        });

        it("should check if kimpay data exists", async () => {
            const kimpay = createMockKimpay("123");
            await storageService.saveKimpayData("123", kimpay);

            expect(await storageService.hasKimpayData("123")).toBe(true);
            expect(await storageService.hasKimpayData("456")).toBe(false);
        });

        it("should preserve myParticipantId when saving kimpay data", async () => {
            // First save with myParticipantId
            const kimpay = createMockKimpay("123", "participant-1");
            await storageService.saveKimpayData("123", kimpay);

            // Save again without myParticipantId
            const updatedKimpay = createMockKimpay("123");
            await storageService.saveKimpayData("123", updatedKimpay);

            const retrieved = await storageService.getKimpayData("123");
            expect(retrieved?.myParticipantId).toBe("participant-1");
        });
    });

    describe("User Identity & My Kimpays", () => {
        it("should manage my participant id via kimpay object", async () => {
            await storageService.setMyParticipantId("kimpay1", "part1");

            expect(await storageService.getMyParticipantId("kimpay1")).toBe(
                "part1"
            );
            expect(
                await storageService.getMyParticipantId("kimpay2")
            ).toBeNull();
        });

        it("should update existing kimpay with participant id", async () => {
            // First save a kimpay
            const kimpay = createMockKimpay("123456789012345");
            await storageService.saveKimpayData("123456789012345", kimpay);

            // Then set participant id
            await storageService.setMyParticipantId("123456789012345", "p1");

            // Verify kimpay still has its data + new participant id
            const retrieved = await storageService.getKimpayData("123456789012345");
            expect(retrieved?.name).toBe("Test Kimpay");
            expect(retrieved?.myParticipantId).toBe("p1");
        });

        it("should list recent kimpay ids from stored kimpay data", async () => {
            // Save kimpays with valid IDs
            const kimpay1 = createMockKimpay("123456789012345", "p1");
            const kimpay2 = createMockKimpay("abcdefghijklmno", "p2");
            await storageService.saveKimpayData("123456789012345", kimpay1);
            await storageService.saveKimpayData("abcdefghijklmno", kimpay2);

            // Also set one via setMyParticipantId (creates minimal entry)
            await storageService.setMyParticipantId("abc", "p3"); // Invalid ID length

            const recents = await storageService.getRecentKimpayIds();
            expect(recents).toContain("123456789012345");
            expect(recents).toContain("abcdefghijklmno");
            expect(recents).not.toContain("abc"); // Invalid ID length filtered out
        });

        it("should remove kimpay when leaving", async () => {
            const kimpay = createMockKimpay("123456789012345", "p1");
            await storageService.saveKimpayData("123456789012345", kimpay);
            
            await storageService.removeRecentKimpay("123456789012345");

            expect(
                await storageService.getKimpayData("123456789012345")
            ).toBeNull();
            expect(
                await storageService.getMyParticipantId("123456789012345")
            ).toBeNull();
        });
    });

    describe("Action Queue", () => {
        it("should save and retrieve pending actions", async () => {
            const action1 = createMockPendingAction("a1");
            const action2 = createMockPendingAction("a2");

            await storageService.savePendingAction(action1);
            await storageService.savePendingAction(action2);

            const queue = await storageService.getPendingActions();
            expect(queue).toHaveLength(2);
            expect(queue).toEqual([action1, action2]);
        });

        it("should remove pending action", async () => {
            const action1 = createMockPendingAction("a1");
            const action2 = createMockPendingAction("a2");

            await storageService.savePendingAction(action1);
            await storageService.savePendingAction(action2);

            await storageService.removePendingAction("a1");

            const queue = await storageService.getPendingActions();
            expect(queue).toHaveLength(1);
            expect(queue[0]).toEqual(action2);
        });

        it("should clear queue", async () => {
            const action1 = createMockPendingAction("a1");
            await storageService.savePendingAction(action1);

            await storageService.clearQueue();

            const queue = await storageService.getPendingActions();
            expect(queue).toHaveLength(0);
        });
    });
});
