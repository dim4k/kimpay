import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PendingAction } from "../../src/lib/services/storage";

// --- Mocks -------------------------------------------------------------------

const mockStore: Record<string, unknown> = {};

vi.mock("idb-keyval", () => ({
    get: vi.fn((key: string) => Promise.resolve(mockStore[key])),
    set: vi.fn((key: string, value: unknown) => {
        mockStore[key] = value;
        return Promise.resolve();
    }),
    update: vi.fn((key: string, updater: (old: unknown) => unknown) => {
        mockStore[key] = updater(mockStore[key]);
        return Promise.resolve();
    }),
    del: vi.fn((key: string) => {
        delete mockStore[key];
        return Promise.resolve();
    }),
    keys: vi.fn(() => Promise.resolve(Object.keys(mockStore))),
}));

const collection = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getOne: vi.fn(),
};
const pb = {
    collection: vi.fn(() => collection),
    send: vi.fn(),
    authStore: { isValid: true, record: { id: "user00000000001" } as { id: string } | null },
    health: { check: vi.fn() },
};
vi.mock("#lib/pocketbase.js", () => ({ pb }));

const toastError = vi.fn();
vi.mock("#lib/stores/toasts.svelte.js", () => ({ toasts: { error: toastError } }));

const { offlineStore, QUEUED } = await import("../../src/lib/stores/offline.svelte");
const { STORAGE_KEYS } = await import("../../src/lib/constants");

// --- Helpers -----------------------------------------------------------------

const networkError = () => ({ status: 0 });
const httpError = (status: number) => ({ status });

function action(id: string, type: PendingAction["type"] = "CREATE_EXPENSE", payload = {}): PendingAction {
    return { id, type, payload: { kimpay: "kimpay000000001", ...payload }, timestamp: 0, kimpayId: "kimpay000000001" };
}

const queue = () => (mockStore[STORAGE_KEYS.OFFLINE_QUEUE] as PendingAction[] | undefined) ?? [];
const setQueue = (actions: PendingAction[]) => (mockStore[STORAGE_KEYS.OFFLINE_QUEUE] = actions);

beforeEach(async () => {
    for (const key in mockStore) delete mockStore[key];
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { onLine: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    pb.authStore.isValid = true;
    pb.authStore.record = { id: "user00000000001" };
    collection.create.mockResolvedValue({ id: "created" });
    collection.update.mockResolvedValue({});
    collection.delete.mockResolvedValue(undefined);
    collection.getOne.mockRejectedValue(httpError(404));
    // Back online (a test may have switched to offline), with an empty queue.
    offlineStore.setOffline(false);
    await offlineStore.processPendingQueue();
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

// --- Replay ------------------------------------------------------------------

describe("offlineStore.processPendingQueue", () => {
    it("replays the queue in order and empties it", async () => {
        setQueue([action("expense00000001"), action("expense00000002", "DELETE_EXPENSE", { id: "expense00000009" })]);

        expect(await offlineStore.processPendingQueue()).toBe(true);
        expect(queue()).toEqual([]);
        expect(collection.create).toHaveBeenCalledTimes(1);
        expect(collection.delete).toHaveBeenCalledWith("expense00000009", { requestKey: null });
    });

    it("stops at a network error, keeping that action and the following ones", async () => {
        setQueue([action("expense00000001"), action("expense00000002")]);
        collection.create.mockRejectedValueOnce(networkError());

        expect(await offlineStore.processPendingQueue()).toBe(false);
        expect(queue().map((a) => a.id)).toEqual(["expense00000001", "expense00000002"]);
        expect(collection.create).toHaveBeenCalledTimes(1);
    });

    it("keeps the order on a server error, and retries later", async () => {
        setQueue([action("participant0001", "CREATE_PARTICIPANT"), action("expense00000002")]);
        collection.create.mockRejectedValueOnce(httpError(500));

        expect(await offlineStore.processPendingQueue()).toBe(false);
        // The dependent expense was not sent (it would be rejected).
        expect(collection.create).toHaveBeenCalledTimes(1);
        expect(queue()).toHaveLength(2);
        expect(queue()[0]).toMatchObject({ attempts: 1 });

        // Not retried before the delay, even when asked.
        expect(await offlineStore.processPendingQueue()).toBe(false);
        expect(collection.create).toHaveBeenCalledTimes(1);

        // Retried automatically once it has passed.
        await vi.advanceTimersByTimeAsync(30_000);
        expect(collection.create).toHaveBeenCalledTimes(3);
        expect(queue()).toEqual([]);
    });

    it("gives up after repeated server errors, and tells the user", async () => {
        setQueue([{ ...action("expense00000001"), attempts: 4 }]);
        collection.create.mockRejectedValueOnce(httpError(503));
        const synced = vi.fn();
        const unsubscribe = offlineStore.onSynced(synced);

        expect(await offlineStore.processPendingQueue()).toBe(true);
        expect(queue()).toEqual([]);
        expect(toastError).toHaveBeenCalledTimes(1);
        expect(synced).toHaveBeenCalledWith([expect.objectContaining({ id: "expense00000001" })]);
        unsubscribe();
    });

    it("drops a rejected action, reports it, and goes on", async () => {
        setQueue([action("expense00000001"), action("expense00000002")]);
        collection.create.mockRejectedValueOnce(httpError(400));
        const synced = vi.fn();
        const unsubscribe = offlineStore.onSynced(synced);

        expect(await offlineStore.processPendingQueue()).toBe(true);
        expect(collection.create).toHaveBeenCalledTimes(2);
        expect(toastError).toHaveBeenCalledTimes(1);
        expect(synced).toHaveBeenCalledWith([expect.objectContaining({ id: "expense00000001" })]);
        unsubscribe();
    });

    it("keeps an action that gets no answer, and switches to offline mode", async () => {
        setQueue([action("expense00000001")]);
        collection.create.mockReturnValueOnce(new Promise(() => {}));

        const replay = offlineStore.processPendingQueue();
        await vi.advanceTimersByTimeAsync(15_000);
        expect(await replay).toBe(false);
        expect(queue()).toHaveLength(1);
        expect(offlineStore.isOffline).toBe(true);
    });

    it("treats a creation that already went through as done", async () => {
        setQueue([action("expense00000001")]);
        collection.create.mockRejectedValueOnce(httpError(400)); // id already taken
        collection.getOne.mockResolvedValueOnce({ id: "expense00000001" });

        expect(await offlineStore.processPendingQueue()).toBe(true);
        expect(collection.getOne).toHaveBeenCalledWith("expense00000001", expect.anything());
        expect(toastError).not.toHaveBeenCalled();
    });

    it("treats a deletion of a missing record as done", async () => {
        setQueue([action("action_1", "DELETE_EXPENSE", { id: "expense00000001" })]);
        collection.delete.mockRejectedValueOnce(httpError(404));

        expect(await offlineStore.processPendingQueue()).toBe(true);
        expect(toastError).not.toHaveBeenCalled();
    });

    it("unlinks a queued participant from an account whose session is gone", async () => {
        setQueue([action("participant0001", "CREATE_PARTICIPANT", { id: "participant0001", name: "Bob", user: "user00000000001" })]);
        pb.authStore.isValid = false;

        await offlineStore.processPendingQueue();
        expect(collection.create.mock.calls[0]![0]).not.toHaveProperty("user");
    });

    it("creates a queued group through the transactional endpoint", async () => {
        const payload = { id: "kimpay000000001", name: "Trip", creator: { id: "participant0001", name: "Al" }, participants: [] };
        setQueue([action("kimpay000000001", "CREATE_KIMPAY", payload)]);
        pb.send.mockResolvedValueOnce({ id: "kimpay000000001" });

        expect(await offlineStore.processPendingQueue()).toBe(true);
        expect(pb.send).toHaveBeenCalledWith("/api/kimpay/create", expect.objectContaining({ method: "POST" }));
        expect(collection.create).not.toHaveBeenCalled();
    });
});

// --- Writes ------------------------------------------------------------------

describe("offlineStore.write", () => {
    const queued = { type: "CREATE_EXPENSE" as const, payload: { amount: 3 }, kimpayId: "kimpay000000001", id: "expense00000001" };

    it("runs online when nothing is queued", async () => {
        const online = vi.fn().mockResolvedValue("record");

        expect(await offlineStore.write(online, queued)).toBe("record");
        expect(queue()).toEqual([]);
    });

    it("queues the write, with its id, when the request fails for lack of network", async () => {
        const online = vi.fn().mockRejectedValue(networkError());

        expect(await offlineStore.write(online, queued)).toBe(QUEUED);
        expect(queue()).toEqual([expect.objectContaining({ id: "expense00000001", payload: { amount: 3 } })]);
    });

    it("queues a write that gets no answer", async () => {
        const online = vi.fn().mockReturnValue(new Promise(() => {}));

        const write = offlineStore.write(online, queued);
        await vi.advanceTimersByTimeAsync(15_000);
        expect(await write).toBe(QUEUED);
        expect(queue()).toHaveLength(1);
        expect(offlineStore.isOffline).toBe(true);
    });

    it("never times out a write that cannot be queued (photo uploads)", async () => {
        let resolve!: (value: string) => void;
        const online = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));

        const write = offlineStore.write(online, null);
        await vi.advanceTimersByTimeAsync(60_000);
        resolve("record");
        expect(await write).toBe("record");
    });

    it("rethrows server errors (the caller rolls back)", async () => {
        const online = vi.fn().mockRejectedValue(httpError(400));

        await expect(offlineStore.write(online, queued)).rejects.toEqual(httpError(400));
        expect(queue()).toEqual([]);
    });

    /** A first write queued for lack of network, then back online. */
    async function queueFirstWrite() {
        await offlineStore.write(
            vi.fn().mockRejectedValue(networkError()),
            { ...queued, type: "CREATE_PARTICIPANT", id: "participant0001" },
        );
        offlineStore.setOffline(false);
    }

    it("queues behind earlier writes that cannot be replayed yet", async () => {
        await queueFirstWrite();
        collection.create.mockRejectedValueOnce(networkError()); // Its replay fails
        const online = vi.fn();

        expect(await offlineStore.write(online, queued)).toBe(QUEUED);
        expect(online).not.toHaveBeenCalled();
        expect(queue().map((a) => a.id)).toEqual(["participant0001", "expense00000001"]);
    });

    it("sends earlier writes first", async () => {
        await queueFirstWrite();
        const online = vi.fn(() => {
            // The queued participant is created before this write is sent.
            expect(collection.create).toHaveBeenCalledTimes(1);
            return Promise.resolve("record");
        });

        expect(await offlineStore.write(online, queued)).toBe("record");
        expect(queue()).toEqual([]);
    });

    it("sends at once, without reading the queue, once it is known empty", async () => {
        const { get } = await import("idb-keyval");
        vi.mocked(get).mockClear();
        let sent = false;
        const write = offlineStore.write(() => {
            sent = true;
            return Promise.resolve("record");
        }, queued);

        // Synchronously, before any storage access.
        expect(sent).toBe(true);
        expect(get).not.toHaveBeenCalled();
        expect(await write).toBe("record");
    });

    it("fails with a network error when the write cannot be queued", async () => {
        await queueFirstWrite();
        collection.create.mockRejectedValueOnce(networkError());

        await expect(offlineStore.write(vi.fn(), null)).rejects.toMatchObject({ status: 0 });
    });
});
