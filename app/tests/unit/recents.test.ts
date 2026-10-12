import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Kimpay, Participant } from "../../src/lib/types";

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

const participants = { getFullList: vi.fn() };
const kimpays = {
    getOne: vi.fn(),
    subscribe: vi.fn(() => Promise.resolve(() => {})),
};
const pb = {
    collection: vi.fn((name: string) => (name === "participants" ? participants : kimpays)),
    filter: vi.fn((raw: string) => raw),
    send: vi.fn(),
    authStore: { isValid: false, record: null },
    health: { check: vi.fn() },
};
vi.mock("#lib/pocketbase.js", () => ({ pb }));

const auth = { user: null as { id: string } | null };
vi.mock("#lib/stores/auth.svelte.js", () => ({ auth }));
vi.mock("#lib/stores/toasts.svelte.js", () => ({ toasts: { error: vi.fn() } }));

const USER = "user00000000001";

/** A group cached on this device, where my identity is `me`. */
function cacheGroup(id: string, me: Partial<Participant>) {
    const participant = { id: `p${id}`.slice(0, 15), name: "Me", kimpay: id, ...me } as Participant;
    mockStore[`kimpay_data_${id}`] = {
        id,
        name: `Group ${id}`,
        created_by: participant.id,
        myParticipantId: participant.id,
        expand: { participants_via_kimpay: [participant], expenses_via_kimpay: [] },
    } as unknown as Kimpay;
}

// Fresh singletons for each test (they keep state).
async function load() {
    vi.resetModules();
    const { recentsStore } = await import("../../src/lib/stores/recents.svelte");
    const { offlineStore } = await import("../../src/lib/stores/offline.svelte");
    return { recentsStore, offlineStore };
}

const ids = (list: { id: string }[]) => list.map((k) => k.id).sort();

beforeEach(() => {
    for (const key in mockStore) delete mockStore[key];
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { onLine: true });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    auth.user = { id: USER };
    participants.getFullList.mockResolvedValue([]);
    kimpays.getOne.mockImplementation((id: string) =>
        Promise.resolve({ id, name: `Group ${id}`, created_by: "" }),
    );
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("recentsStore with an account", () => {
    it("forgets a group left from another device", async () => {
        cacheGroup("kimpayleft00001", { user: USER });
        cacheGroup("kimpaykept00001", { user: USER });
        participants.getFullList.mockResolvedValue([
            { id: "pkimpaykept0000", kimpay: "kimpaykept00001", user: USER },
        ]);
        const { recentsStore } = await load();

        await recentsStore.init();
        expect(ids(recentsStore.recentKimpays)).toEqual(["kimpaykept00001"]);
        expect(mockStore).not.toHaveProperty("kimpay_data_kimpayleft00001");
    });

    it("keeps groups only opened by link (identity never linked)", async () => {
        cacheGroup("kimpaylink00001", { user: "" });
        const { recentsStore } = await load();

        await recentsStore.init();
        expect(ids(recentsStore.recentKimpays)).toEqual(["kimpaylink00001"]);
    });

    it("keeps groups linked to another account", async () => {
        cacheGroup("kimpayother0001", { user: "user00000000002" });
        const { recentsStore } = await load();

        await recentsStore.init();
        expect(ids(recentsStore.recentKimpays)).toEqual(["kimpayother0001"]);
    });

    it("keeps everything when the account cannot be read", async () => {
        cacheGroup("kimpayleft00001", { user: USER });
        participants.getFullList.mockRejectedValue({ status: 0 });
        const { recentsStore } = await load();

        await recentsStore.init();
        expect(ids(recentsStore.recentKimpays)).toEqual(["kimpayleft00001"]);
    });

    it("keeps the group being viewed", async () => {
        cacheGroup("kimpayopen00001", { user: USER });
        const { recentsStore } = await load();
        const { activeKimpayGlobal } = await import("../../src/lib/stores/activeKimpayGlobal.svelte");
        activeKimpayGlobal.setInstance({ id: "kimpayopen00001" } as never);

        await recentsStore.init();
        expect(ids(recentsStore.recentKimpays)).toEqual(["kimpayopen00001"]);
    });
});

describe("recentsStore started without the server", () => {
    it("validates and subscribes once back online", async () => {
        auth.user = null;
        cacheGroup("kimpaygone00001", { user: "" });
        cacheGroup("kimpaykept00001", { user: "" });
        kimpays.getOne.mockImplementation((id: string) =>
            id === "kimpaygone00001"
                ? Promise.reject({ status: 404 })
                : Promise.resolve({ id, name: "Renamed", created_by: "" }),
        );
        const { recentsStore, offlineStore } = await load();

        offlineStore.setOffline(true);
        await recentsStore.init();
        expect(kimpays.getOne).not.toHaveBeenCalled();
        expect(ids(recentsStore.recentKimpays)).toEqual(["kimpaygone00001", "kimpaykept00001"]);

        offlineStore.setOffline(false);
        await vi.waitFor(() => expect(ids(recentsStore.recentKimpays)).toEqual(["kimpaykept00001"]));
        expect(recentsStore.recentKimpays[0]!.name).toBe("Renamed");
        expect(kimpays.subscribe).toHaveBeenCalledWith("kimpaykept00001", expect.any(Function));
    });

    it("does not validate again once done", async () => {
        auth.user = null;
        cacheGroup("kimpaykept00001", { user: "" });
        const { recentsStore, offlineStore } = await load();

        await recentsStore.init();
        expect(kimpays.getOne).toHaveBeenCalledTimes(1);

        offlineStore.setOffline(true);
        offlineStore.setOffline(false);
        await vi.advanceTimersByTimeAsync(0);
        expect(kimpays.getOne).toHaveBeenCalledTimes(1);
    });
});
