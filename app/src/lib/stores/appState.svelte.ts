import { pb } from "$lib/pocketbase";
import type { Kimpay, Participant, Expense, RecentKimpay } from "$lib/types";
import { storageService } from "$lib/services/storage";

class AppState {
    kimpay = $state<Kimpay | null>(null);
    participant = $state<Participant | null>(null);
    expenses: Expense[] = $state([]);
    participants: Participant[] = $state([]);

    // Recent Kimpays State
    recentKimpays: RecentKimpay[] = $state([]);
    loadingRecentKimpays = $state(false);
    initializedRecentKimpays = $state(false);

    // Offline / Sync State
    isOffline = $state(false);
    isSyncing = $state(false);

    private subscribedKimpayId: string | null = null;
    private initPromise: Promise<void> | null = null;
    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        if (typeof window !== "undefined") {
            this.setOffline(!navigator.onLine);
            window.addEventListener("online", () => this.setOffline(false));
            window.addEventListener("offline", () => this.setOffline(true));
            
            // Global Network Error Interceptor
            const originalSend = pb.send;
            pb.send = async <T = unknown>(path: string, options: Record<string, unknown>): Promise<T> => {
                try {
                    const result = await originalSend.call(pb, path, options);
                    if (this.isOffline && path !== '/api/health') {
                        this.setOffline(false);
                    }
                    return result as T;
                } catch (e: unknown) {
                    if ((e as { status?: number })?.status === 0) {
                        this.setOffline(true);
                    }
                    throw e;
                }
            };
        }
    }

    async init(
        kimpayId: string,
        force = false,
        initialData: Kimpay | null = null
    ) {
        if (
            !force &&
            this.kimpay?.id === kimpayId &&
            this.participants.length > 0
        ) {
              // If we are offline, we are done (we loaded from cache)
             if (this.isOffline) return;
        }

        // 0. Load from Local Storage First (Instant Load)
        if (!this.kimpay || this.kimpay.id !== kimpayId) {
            const cached = storageService.getKimpayData(kimpayId);
            if (cached) {
                this.kimpay = cached;
                this.participants = cached.expand?.participants_via_kimpay || [];
                const ex = cached.expand?.expenses_via_kimpay || [];
                this.expenses = this.sortExpenses(ex);
                
                // Identify User quickly from cache
                this.identifyUser(kimpayId);
            }
        }

        // Prevent concurrent fetches
        if (this.initPromise) {
            // If we have data, we don't need to wait for the pending fetch
            if (this.kimpay?.id === kimpayId && !force) return;
            await this.initPromise;
            if (!force && this.kimpay?.id === kimpayId) return;
        }

        this.initPromise = (async () => {
            try {
                // 1. Fetch Kimpay with participants and expenses expanded
                if (initialData) {
                    this.kimpay = initialData;
                } else if (!this.isOffline) {
                    // We cast because the SDK returns a generic RecordModel but we know the shape via expansion
                    const record = await pb
                        .collection("kimpays")
                        .getOne(kimpayId, {
                            expand: "participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved",
                            requestKey: null,
                        });
                    this.kimpay = record as unknown as Kimpay;
                    
                    // Cache the fresh data
                    storageService.saveKimpayData(kimpayId, this.kimpay);
                }

                if (!this.kimpay) return;

                this.participants =
                    this.kimpay?.expand?.participants_via_kimpay || [];

                const ex = this.kimpay?.expand?.expenses_via_kimpay || [];
                this.expenses = this.sortExpenses(ex);

                // 2. Identify User
                this.identifyUser(kimpayId);

                // 4. Subscribe to Realtime Updates
                if (!this.isOffline) {
                    this.subscribe(kimpayId);
                    this.processPendingQueue();
                }
            } catch (e: unknown) {
                console.error("Error initializing app state", e);
                if ((e as { status?: number })?.status === 0) {
                    this.setOffline(true);
                }
            }
        })();

        // If we have data from cache, return immediately (Stale-While-Revalidate)
        if (this.kimpay?.id === kimpayId) {
            this.initPromise.finally(() => { this.initPromise = null });
            return;
        }

        try {
            await this.initPromise;
        } finally {
            this.initPromise = null;
        }
    }

    unsubscribe() {
        if (!this.subscribedKimpayId) return;

        pb.collection("kimpays").unsubscribe("*"); // Or specific
        pb.collection("participants").unsubscribe("*");
        pb.collection("expenses").unsubscribe("*");

        this.subscribedKimpayId = null;
    }

    subscribe(kimpayId: string) {
        if (this.subscribedKimpayId === kimpayId) return;

        // Unsubscribe previous to avoid duplicates if re-init
        this.unsubscribe();

        this.subscribedKimpayId = kimpayId;

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
                const res = await pb.collection("kimpays").getOne(kimpayId, {
                    expand: "participants_via_kimpay",
                    requestKey: null,
                });
                const updatedKimpay = res as unknown as Kimpay;
                this.participants =
                    updatedKimpay.expand?.participants_via_kimpay || [];
                
                // Keep local cache fresh
                if (this.kimpay) {
                     this.kimpay.expand = {
                         ...this.kimpay.expand,
                         participants_via_kimpay: this.participants
                     };
                     storageService.saveKimpayData(this.kimpay.id, this.kimpay);
                }
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

    private identifyUser(kimpayId: string) {
        if (typeof localStorage !== "undefined") {
            const stored = JSON.parse(
                localStorage.getItem("my_kimpays") || "{}"
            );
            const participantId = stored[kimpayId];

            if (participantId) {
                this.participant =
                    this.participants.find(
                        (p) => p.id === participantId
                    ) || null;
            }
        }
    }

    private sortExpenses(ex: Expense[]) {
         return ex.sort((a, b) => {
            const dateDiff =
                new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return (
                new Date(b.created).getTime() -
                new Date(a.created).getTime()
            );
        });
    }

    async refreshExpenses() {
        if (!this.kimpay || this.isOffline) return;

        const k = await pb.collection("kimpays").getOne(this.kimpay.id, {
            expand: "expenses_via_kimpay.payer,expenses_via_kimpay.involved",
            requestKey: null,
        });
        const kimpayRecord = k as unknown as Kimpay;
        const ex = kimpayRecord.expand?.expenses_via_kimpay || [];
        this.expenses = this.sortExpenses(ex);
        
        // Update Cache
        storageService.saveKimpayData(this.kimpay.id, kimpayRecord);
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

    // --- Offline Actions ---

    setOffline(status: boolean) {
        if (this.isOffline === status) return;
        this.isOffline = status;
        
        if (status) {
            this.startHealthCheck();
        } else {
            this.stopHealthCheck();
            this.processPendingQueue();
            if (this.kimpay) {
                // Re-init to fetch full fresh data (participants + expenses)
                this.init(this.kimpay.id, true);
            }
        }
    }

    private startHealthCheck() {
        if (this.healthCheckInterval) return;
        this.healthCheckInterval = setInterval(async () => {
             try {
                 const health = await pb.health.check();
                 if (health.code === 200) {
                     this.setOffline(false);
                 }
             } catch (_) {
                 // Still offline
             }
        }, 3000);
    }

    private stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    async createExpense(formData: FormData) {
        const kimpayId = formData.get('kimpay') as string;
        if (!kimpayId) throw new Error("Kimpay ID missing");

        // If ONLINE -> Push directly
        if (!this.isOffline) {
            try {
                await pb.collection('expenses').create(formData);
                // Realtime will handle the update
                return;
            } catch (e: unknown) {
                // Network error (status 0) -> switch to offline mode and fall through
                if ((e as { status?: number })?.status === 0) {
                    console.warn("Network error during create, switching to offline mode");
                    this.setOffline(true);
                } else {
                    throw e;
                }
            }
        }

        // If OFFLINE -> Queue & Optimistic Update
        
        // 1. Create Optimistic Expense
        const tempId = `temp_${Date.now()}`;
        const payerId = formData.get('payer') as string;
        const involvedIds = formData.getAll('involved') as string[];
        
        // Reconstruct expand for UI
        const payerParticipant = this.participants.find(p => p.id === payerId);
        const expandData: { payer?: Participant, involved?: Participant[] } = {
            involved: this.participants.filter(p => involvedIds.includes(p.id))
        };
        if (payerParticipant) {
            expandData.payer = payerParticipant;
        }

        const optimisticExpense: Expense = {
            id: tempId,
            collectionId: 'expenses',
            collectionName: 'expenses',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            amount: parseFloat(formData.get('amount') as string),
            description: formData.get('description') as string,
            date: formData.get('date') as string,
            payer: payerId,
            involved: involvedIds,
            kimpay: kimpayId,
            created_by: payerId, // Assuming creator is payer for simplicity in offline
            is_reimbursement: false,
            // START FIX: Add icon to optimistic expense
            icon: formData.get('icon') as string,
            // END FIX
            expand: expandData
        };

        // 2. Update UI State
        this.expenses = this.sortExpenses([...this.expenses, optimisticExpense]);
        
        // 3. Queue Action
        const payload: Record<string, unknown> = {};
        formData.forEach((value, key) => {
             if (key === 'involved') {
                 if (!payload[key]) payload[key] = [];
                 (payload[key] as string[]).push(value as string);
             } else {
                 payload[key] = value;
             }
        });

        storageService.savePendingAction({
            id: tempId,
            type: 'CREATE_EXPENSE',
            payload,
            timestamp: Date.now(),
            kimpayId
        });
    }

    async createParticipant(kimpayId: string, name: string): Promise<Participant> {
        // If ONLINE -> Push directly
        if (!this.isOffline) {
            try {
                const record = await pb.collection('participants').create({
                    name,
                    kimpay: kimpayId
                });
                return record as unknown as Participant;
            } catch (e: unknown) {
                 if ((e as { status?: number })?.status === 0) {
                     console.warn("Network error during add participant, switching to offline");
                     this.setOffline(true);
                     // Fallthrough to offline logic
                 } else {
                     throw e;
                 }
            }
        }

        // Offline Logic
        const tempId = `temp_p_${Date.now()}`;
        const optimisticParticipant: Participant = {
            id: tempId,
            collectionId: 'participants',
            collectionName: 'participants',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            name,
            kimpay: kimpayId
        };
        
        this.participants = [...this.participants, optimisticParticipant];
        // Keep cache in sync
        if (this.kimpay) {
            this.kimpay.expand = {
                ...this.kimpay.expand,
                participants_via_kimpay: this.participants
            };
            storageService.saveKimpayData(kimpayId, this.kimpay);
        }
        
        storageService.savePendingAction({
            id: tempId,
            type: 'CREATE_PARTICIPANT',
            payload: { name, kimpay: kimpayId },
            timestamp: Date.now(),
            kimpayId
        });
        
        return optimisticParticipant;
    }

    async processPendingQueue() {
        if (this.isSyncing || this.isOffline) return;
        
        const queue = storageService.getPendingActions();
        if (queue.length === 0) return;

        this.isSyncing = true;
        const idMapping: Record<string, string> = {}; // TempID -> RealID
        console.log(`Syncing ${queue.length} offline actions...`);

        try {
            for (const action of queue) {
                try {
                    // Clone payload to allow modification
                    const payload = { ...action.payload };
                    
                    // Replace Payer Dependency
                    if (typeof payload.payer === 'string' && payload.payer in idMapping) {
                        payload.payer = idMapping[payload.payer];
                    }
                    
                    // Replace Involved Dependency
                    if (Array.isArray(payload.involved)) {
                        payload.involved = payload.involved.map((id: string) => idMapping[id] || id);
                    }

                    if (action.type === 'CREATE_PARTICIPANT') {
                         const record = await pb.collection('participants').create(payload);
                         idMapping[action.id] = record.id;
                         
                         // Remove optimistic participant
                         this.participants = this.participants.filter(p => p.id !== action.id);
                         if (this.kimpay) {
                             this.kimpay.expand = {
                                 ...this.kimpay.expand,
                                 participants_via_kimpay: this.participants
                             };
                         }
                    }
                    else if (action.type === 'CREATE_EXPENSE') {
                        // Reconstruct FormData for expense
                        const formData = new FormData();
                        Object.entries(payload).forEach(([key, value]) => {
                             if (Array.isArray(value)) {
                                 value.forEach(v => formData.append(key, v as string));
                             } else {
                                 formData.append(key, value as string);
                             }
                        });

                        const record = await pb.collection('expenses').create(formData);
                        idMapping[action.id] = record.id;
                        
                        // Remove optimistic expense? 
                        // NO: If we remove it here, there is a gap before refreshExpenses() completes where the UI shows old state.
                        // refreshExpenses() will overwrite the whole list anyway, effectively replacing the optimistic one with the real one.
                        
                        await this.refreshExpenses();
                    }
                    
                    storageService.removePendingAction(action.id);
                } catch (e) {
                    console.error("Failed to sync action", action.id, e);
                }
            }
        } finally {
            this.isSyncing = false;
        }
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
                        if (err.status === 0) return { id, status: "network_error" as const };
                        if (err.status === 404 || err.status === 403)
                            return { id, status: "missing" as const };
                        return { id, status: "error" as const };
                    })
            );

            if (this.isOffline) {
                 const offlineItems: RecentKimpay[] = [];
                 for(const id of ids) {
                     const cached = storageService.getKimpayData(id);
                     if (cached) {
                         const item: RecentKimpay = {
                             id: cached.id,
                             name: cached.name,
                             created_by: cached.created_by
                         };
                         if (cached.icon) item.icon = cached.icon;
                         offlineItems.push(item);
                     }
                 }
                 this.recentKimpays = offlineItems;
                 this.initializedRecentKimpays = true;
                 return;
            }

            const results = await Promise.all(promises);

            if (results.some(r => r.status === 'network_error')) {
                 this.setOffline(true);
                 const offlineItems: RecentKimpay[] = [];
                 for(const id of ids) {
                     const cached = storageService.getKimpayData(id);
                     if (cached) {
                          const item: RecentKimpay = {
                              id: cached.id,
                              name: cached.name,
                              created_by: cached.created_by
                          };
                          if (cached.icon) item.icon = cached.icon;
                          offlineItems.push(item);
                     }
                 }
                 this.recentKimpays = offlineItems;
                 this.initializedRecentKimpays = true;
                 return;
            }
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
