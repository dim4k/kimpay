
import { pb } from './pocketbase';

class AppState {
    kimpay = $state<any>(null);
    participant = $state<any>(null);
    expenses = $state<any[]>([]);
    
    constructor() {}

    async init(kimpayId: string) {
        if (this.kimpay?.id === kimpayId) return; // Already loaded

        try {
            // 1. Fetch Kimpay
            this.kimpay = await pb.collection('kimpays').getOne(kimpayId);

            // 2. Identify User
            const stored = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
            const participantId = stored[kimpayId];

            if (participantId) {
                this.participant = await pb.collection('participants').getOne(participantId).catch(() => null);
            }

            // 3. Fetch Expenses
            await this.refreshExpenses();

        } catch (e) {
            console.error("Error initializing app state", e);
        }
    }

    async refreshExpenses() {
        if (!this.kimpay) return;
        this.expenses = await pb.collection('expenses').getFullList({
            filter: `kimpay="${this.kimpay.id}"`,
            sort: '-date',
            expand: 'payer,involved' // Expand relations
        });
    }

    get balance() {
        // TODO: Calc balance
        return [];
    }
}

export const appState = new AppState();
