
import { pb } from './pocketbase';

class AppState {
    kimpay = $state<any>(null);
    participant = $state<any>(null);
    expenses = $state<any[]>([]);
    participants = $state<any[]>([]); // New property
    
    constructor() {}

    async init(kimpayId: string, force = false) {
        if (!force && this.kimpay?.id === kimpayId && this.participants.length > 0) return; // Already loaded

        try {
            // 1. Fetch Kimpay with participants and expenses expanded
            this.kimpay = await pb.collection('kimpays').getOne(kimpayId, {
                expand: 'participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved'
            });
            this.participants = this.kimpay?.expand?.participants_via_kimpay || [];

            // 2. Identify User
            const stored = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
            const participantId = stored[kimpayId];

            if (participantId) {
                // We likely already have this participant in the list, no need to fetch again?
                // But getting specific record ensures freshness if needed. 
                // However, expand data should be enough for basic info.
                // Let's try to find it in the list first to save a call, or just fetch if generic auth needed.
                // Actually, for "who am i", we just need the record.
                this.participant = this.participants.find(p => p.id === participantId) || null;
                
                // If not found in list (weird?), fetch individually (might fail if list forbidden? No, getOne usually allowed if you are it?)
                // Actually, if we rely on expand, we trust it.
            }

            // 3. Fetch Expenses
            await this.refreshExpenses();

        } catch (e) {
            console.error("Error initializing app state", e);
        }
    }

    async refreshExpenses() {
        if (!this.kimpay) return;
        // If we already expanded them in init, we can use them.
        // But what if we want to refresh ONLY expenses? We'd need to re-fetch kimpay with expand.
        // Given init fetches them, let's try to reuse or re-fetch properly.
        
        // If expenses are already in kimpay.expand (from init)
        if (this.kimpay.expand?.expenses_via_kimpay) {
            this.expenses = this.kimpay.expand.expenses_via_kimpay;
            // They come sorted by default? No, usually by ID or created.
            // We can sort them client side
            this.expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
             // Re-fetch via kimpay to get them
             const k = await pb.collection('kimpays').getOne(this.kimpay.id, {
                 expand: 'expenses_via_kimpay.payer,expenses_via_kimpay.involved'
             });
             const ex = k.expand?.expenses_via_kimpay || [];
             ex.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
             this.expenses = ex;
        }
    }

    get balance() {
        // TODO: Calc balance
        return [];
    }
    reset() {
        this.kimpay = null;
        this.participant = null;
        this.expenses = [];
        this.participants = [];
    }
}

export const appState = new AppState();
