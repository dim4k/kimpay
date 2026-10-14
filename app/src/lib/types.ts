export interface User {
    id: string;
    username: string;
    email: string;
    name: string;
    avatar?: string;
    preferred_currency?: string;
    /** Payment handles of the profile (private, see profileStore) */
    paypal?: string;
    revolut?: string;
    /** Groups archived by the user (null until a first one) */
    archived_kimpays?: string[] | null;
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
    avatar?: string;
    user?: string; // Linked User ID
    /** Public payment handles: paypal.me/<paypal>, revolut.me/<revolut> */
    paypal?: string;
    revolut?: string;
    /** Uses the group (picked this name on a device, or has an account) */
    joined?: boolean;
    /** No longer ticked by default in new expenses */
    inactive?: boolean;
    /** Shares in new expenses (0 or missing = 1) */
    default_shares?: number;
    expand?: {
        kimpay?: Kimpay;
        user?: User;
    };
}

/**
 * How an expense is shared between its involved participants.
 * - equal:   same share for everyone (also when `split` is missing)
 * - shares:  `values` = number of shares per participant
 * - amounts: `values` = exact amount per participant, in the expense currency
 * - percent: `values` = percentage per participant
 */
export type SplitMode = 'equal' | 'shares' | 'amounts' | 'percent';

export interface ExpenseSplit {
    mode: SplitMode;
    values?: Record<string, number>; // participant ID -> value
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
    /** Money received by the group: `payer` is the one who received it. */
    is_income?: boolean;
    currency: string;
    /** Expense currency -> Kimpay currency, frozen at the expense date (0 = unknown). */
    exchange_rate?: number;
    split?: ExpenseSplit | null;
    icon?: string;
    photos?: string[];
    /** Repeated every month on this day (1-31, see lib/repeat.ts); 0 = not repeated */
    repeat_day?: number;
    /** Date of the next copy, made by the server ("" = none) */
    repeat_next?: string;
    /** The expense this one was copied from (the previous month's) */
    repeat_of?: string;
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
    currency: string;
    icon?: string;
    invite_token?: string;
    /** Secret of the read-only summary link ("" = no link). */
    readonly_token?: string;
    created_by: string;
    /** Account allowed to delete the group ("" = none yet) */
    owner?: string;
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
