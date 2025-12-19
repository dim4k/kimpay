export interface User {
    id: string;
    username: string;
    email: string;
    name: string;
    avatar?: string;
    created: string;
    updated: string;
}

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
    user?: string; // Linked User ID
    expand?: {
        kimpay?: Kimpay;
        user?: User;
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
    /** Local-only: ID of the current user's participant in this Kimpay */
    myParticipantId?: string;
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
}

// =============================================================================
// Type Conversion Helpers (Branded Casts)
// =============================================================================
// These functions provide type-narrowing from PocketBase RecordModel to our
// domain types. They perform NO runtime validation - they trust that PocketBase
// records conform to our schemas. This is intentional for performance reasons.
//
// Usage: Prefer these over raw `as Type` casts for:
//   1. Consistent conversion points (easier to refactor if we add validation)
//   2. Self-documenting code intent
//   3. Array conversions without inline cast noise

import type { RecordModel } from "pocketbase";

/** Branded cast: RecordModel → Expense (no runtime validation) */
export function asExpense(record: RecordModel): Expense {
    return record as Expense;
}

/** Branded cast: RecordModel[] → Expense[] (no runtime validation) */
export function asExpenses(records: RecordModel[]): Expense[] {
    return records as Expense[];
}

/** Branded cast: RecordModel → Participant (no runtime validation) */
export function asParticipant(record: RecordModel): Participant {
    return record as Participant;
}

/** Branded cast: RecordModel → Kimpay (no runtime validation) */
export function asKimpay(record: RecordModel): Kimpay {
    return record as Kimpay;
}

/** Branded cast: RecordModel[] → Participant[] (no runtime validation) */
export function asParticipants(records: RecordModel[]): Participant[] {
    return records as Participant[];
}

/** Branded cast: RecordModel → RecentKimpay (partial, no runtime validation) */
export function asRecentKimpay(record: RecordModel): RecentKimpay {
    return record as unknown as RecentKimpay;
}
