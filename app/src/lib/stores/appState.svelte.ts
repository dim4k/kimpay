import { pb } from "$lib/pocketbase";
import type { Kimpay, Participant, Expense, RecentKimpay } from "$lib/types";

class AppState {
    kimpay = $state<Kimpay | null>(null);
    participant = $state<Participant | null>(null);
    expenses: Expense[] = $state([]);
    participants: Participant[] = $state([]);

    // Recent Kimpays State
    recentKimpays: RecentKimpay[] = $state([]);
    loadingRecentKimpays = $state(false);
    initializedRecentKimpays = $state(false);

    constructor() {}

    async init(kimpayId: string, force = false) {
        if (
            !force &&
            this.kimpay?.id === kimpayId &&
            this.participants.length > 0
        )
            return; // Already loaded

        try {
            // 1. Fetch Kimpay with participants and expenses expanded
            // We cast because the SDK returns a generic RecordModel but we know the shape via expansion
            const record = await pb.collection("kimpays").getOne(kimpayId, {
                expand: "participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved",
                requestKey: null,
            });

            this.kimpay = record as unknown as Kimpay;
            this.participants =
                this.kimpay?.expand?.participants_via_kimpay || [];

            const ex = this.kimpay?.expand?.expenses_via_kimpay || [];
            ex.sort((a, b) => {
                const dateDiff =
                    new Date(b.date).getTime() - new Date(a.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (
                    new Date(b.created).getTime() -
                    new Date(a.created).getTime()
                );
            });
            this.expenses = ex;

            // 2. Identify User
            if (typeof localStorage !== "undefined") {
                const stored = JSON.parse(
                    localStorage.getItem("my_kimpays") || "{}"
                );
                const participantId = stored[kimpayId];

                if (participantId) {
                    this.participant =
                        this.participants.find((p) => p.id === participantId) ||
                        null;
                }
            }

            // 4. Subscribe to Realtime Updates
            this.subscribe(kimpayId);
        } catch (e) {
            console.error("Error initializing app state", e);
        }
    }

    unsubscribe() {
        pb.collection("kimpays").unsubscribe("*"); // Or specific
        pb.collection("participants").unsubscribe("*");
        pb.collection("expenses").unsubscribe("*");
    }

    subscribe(kimpayId: string) {
        // Unsubscribe previous to avoid duplicates if re-init
        this.unsubscribe();

        // 1. Kimpay details
        pb.collection("kimpays").subscribe(kimpayId, (e) => {
            if (this.kimpay && e.action === "update") {
                this.kimpay = { ...this.kimpay, ...e.record } as Kimpay;
                // Also refresh expenses since creating an expense touches the kimpay record
                this.refreshExpenses();
            } else if (e.action === "delete") {
                // Handle deletion? Redirect?
                this.kimpay = null;
            }
        });

        // 2. Participants
        pb.collection("participants").subscribe("*", async (e) => {
            // Filter client side if server filter not robust in subscribe
            if (e.record.kimpay === kimpayId) {
                const res = await pb
                    .collection("kimpays")
                    .getOne(kimpayId, {
                        expand: "participants_via_kimpay",
                        requestKey: null,
                    });
                const updatedKimpay = res as unknown as Kimpay;
                this.participants =
                    updatedKimpay.expand?.participants_via_kimpay || [];
            }
        });

        // 3. Expenses
        pb.collection("expenses").subscribe("*", async (e) => {
            if (e.record.kimpay === kimpayId) {
                // Refresh expenses
                await this.refreshExpenses();
            }
        });
    }

    async refreshExpenses() {
        if (!this.kimpay) return;

        const k = await pb.collection("kimpays").getOne(this.kimpay.id, {
            expand: "expenses_via_kimpay.payer,expenses_via_kimpay.involved",
            requestKey: null,
        });
        const kimpayRecord = k as unknown as Kimpay;
        const ex = kimpayRecord.expand?.expenses_via_kimpay || [];
        ex.sort((a, b) => {
            const dateDiff =
                new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return (
                new Date(b.created).getTime() - new Date(a.created).getTime()
            );
        });
        this.expenses = ex;
    }

    get balance() {
        // TODO: Calc balance
        return [];
    }
    reset() {
        this.unsubscribe();
        this.kimpay = null;
        this.participant = null;
        this.expenses = [];
        this.participants = [];
    }

    // --- Recents Logic ---

    async initRecentKimpays() {
        if (this.initializedRecentKimpays || this.loadingRecentKimpays) return;
        if (typeof localStorage === "undefined") return;

        try {
            this.loadingRecentKimpays = true;
            const myKimpays = JSON.parse(
                localStorage.getItem("my_kimpays") || "{}"
            );
            const ids = Object.keys(myKimpays).filter(
                (id) => id && /^[a-zA-Z0-9]{15}$/.test(id)
            );

            if (ids.length === 0) {
                this.recentKimpays = [];
                this.initializedRecentKimpays = true;
                return;
            }

            const promises = ids.map((id) =>
                pb
                    .collection("kimpays")
                    .getOne(id, { requestKey: null })
                    .then((data) => ({
                        id,
                        data: data as unknown as RecentKimpay,
                        status: "found" as const,
                    }))
                    .catch((err) => {
                        if (err.status === 404 || err.status === 403)
                            return { id, status: "missing" as const };
                        return { id, status: "error" as const };
                    })
            );

            const results = await Promise.all(promises);
            const fetchedItems = results
                .filter(
                    (
                        r
                    ): r is {
                        id: string;
                        data: RecentKimpay;
                        status: "found";
                    } => r.status === "found"
                )
                .map((r) => r.data);

            const missingIds = results
                .filter((r) => r.status === "missing")
                .map((r) => r.id);
            if (missingIds.length > 0) {
                missingIds.forEach((id) => {
                    delete myKimpays[id];
                    localStorage.removeItem(`kimpay_user_${id}`);
                });
                localStorage.setItem("my_kimpays", JSON.stringify(myKimpays));
            }

            this.recentKimpays = fetchedItems;
            this.initializedRecentKimpays = true;

            // Subscribe to each item
            this.recentKimpays.forEach((item) => {
                pb.collection("kimpays")
                    .subscribe(item.id, (e) => {
                        if (e.action === "update") {
                            this.updateRecentKimpay(
                                e.record as unknown as RecentKimpay
                            );
                        } else if (e.action === "delete") {
                            this.removeRecentKimpay(e.record.id);
                        }
                    })
                    .catch((err) =>
                        console.warn("Failed to subscribe to", item.id, err)
                    );
            });
        } catch (e) {
            console.error("Failed to load recent kimpays", e);
        } finally {
            this.loadingRecentKimpays = false;
        }
    }

    removeRecentKimpay(id: string) {
        this.recentKimpays = this.recentKimpays.filter((k) => k.id !== id);
    }

    addRecentKimpay(kimpay: RecentKimpay) {
        if (!kimpay || !kimpay.id) return;
        if (!this.recentKimpays.find((k) => k.id === kimpay.id)) {
            this.recentKimpays = [kimpay, ...this.recentKimpays];
            // Subscribe
            pb.collection("kimpays")
                .subscribe(kimpay.id, (e) => {
                    if (e.action === "update") {
                        this.updateRecentKimpay(
                            e.record as unknown as RecentKimpay
                        );
                    } else if (e.action === "delete") {
                        this.removeRecentKimpay(e.record.id);
                    }
                })
                .catch((err) =>
                    console.warn(
                        "Failed to subscribe to new kimpay",
                        kimpay.id,
                        err
                    )
                );
        } else {
            this.updateRecentKimpay(kimpay);
        }
    }

    updateRecentKimpay(kimpay: RecentKimpay) {
        if (!kimpay || !kimpay.id) return;
        this.recentKimpays = this.recentKimpays.map((k) =>
            k.id === kimpay.id ? { ...k, ...kimpay } : k
        );
    }
}

export const appState = new AppState();
