export interface Participant {
    id: string;
    collectionId: string;
    collectionName: string;
    created: string;
    updated: string;
    name: string;
    kimpay: string;
    local_id?: string;
    avatar?: string;
    expand?: {
        kimpay?: Kimpay;
    };
}

export interface Expense {
    id: string;
    collectionId: string;
    collectionName: string;
    created: string;
    updated: string;
    amount: number;
    description: string;
    date: string;
    payer: string;
    involved: string[]; // List of participant IDs
    kimpay: string;
    created_by: string;
    is_reimbursement: boolean;
    icon?: string;
    photos?: string[];
    expand?: {
        payer?: Participant;
        involved?: Participant[];
    };
}

export interface Kimpay {
    id: string;
    collectionId: string;
    collectionName: string;
    created: string;
    updated: string;
    name: string;
    icon?: string;
    invite_token?: string;
    created_by: string;
    expand?: {
        participants_via_kimpay?: Participant[];
        expenses_via_kimpay?: Expense[];
    };
}

export interface RecentKimpay {
    id: string;
    name: string;
    icon?: string;
    created_by?: string;
    // Add other properties if needed for the recent list (e.g. partial Kimpay)
}
