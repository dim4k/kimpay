import { pb } from '#lib/pocketbase.js';
import { STORAGE_KEYS } from '#lib/constants.js';
import { prefs } from '#lib/utils/prefs.js';
import type { RepeatFrequency } from '#lib/repeat.js';

/** What happened (see the `activities` collection). */
export type ActivityAction =
    | 'expense_created'
    | 'expense_updated'
    | 'expense_deleted'
    /** A repeated expense copied by the server (no actor) */
    | 'expense_repeated'
    | 'reimbursement_created'
    | 'reimbursement_deleted'
    | 'participant_added'
    | 'participant_renamed'
    | 'participant_deleted'
    | 'participants_merged'
    | 'participant_payment_changed'
    | 'participant_defaults_changed'
    | 'currency_changed';

/** A payment link before / after a change ("" = none). */
export interface HandleChange {
    from: string;
    to: string;
}

/** An expense as the history shows it (names at the time of the change). */
export interface ExpenseSnapshot {
    description: string;
    icon: string;
    amount: number;
    currency: string;
    /** "YYYY-MM-DD" */
    date: string;
    payer: string;
    involved: string[];
    split: string;
    income: boolean;
    photos: number;
    /** How often it repeats, "" = not (a yes/no in older lines; lines logged since repetitions exist) */
    repeat?: RepeatFrequency | '' | boolean;
}

export interface Activity {
    id: string;
    action: ActivityAction;
    /** Participant who made the change ("" when unknown) */
    actor: string;
    actor_name: string;
    /** Expense or participant concerned */
    target: string;
    data: Partial<ExpenseSnapshot> & {
        /** Members */
        name?: string;
        from?: string;
        to?: string;
        into?: string;
        /** Currency changed: 1 from = rate to (when expenses were converted) */
        rate?: number;
        /** Payment links changed (the services changed only) */
        paypal?: HandleChange;
        revolut?: HandleChange;
        /** New expense settings changed (the values changed only) */
        inactive?: { from: boolean; to: boolean };
        default_shares?: { from: number; to: number };
        /** Updates */
        changed?: (keyof ExpenseSnapshot)[];
        before?: ExpenseSnapshot;
        after?: ExpenseSnapshot;
    };
    /** PocketBase datetime ("2026-10-12 08:30:00.000Z") */
    created: string;
}

/** The latest lines of a group's history, newest first. Online only. */
export function listActivity(kimpayId: string): Promise<Activity[]> {
    return pb.send<Activity[]>(`/api/kimpay/${kimpayId}/activity`, { method: 'GET', requestKey: null });
}

export function activityTime(activity: Pick<Activity, 'created'>): number {
    return new Date(activity.created.replace(' ', 'T')).getTime();
}

// The "new" dots show the expenses added since my last visit; what others
// changed or deleted since then is counted from the history.
const CHANGES: readonly ActivityAction[] = [
    'expense_updated',
    'expense_deleted',
    'reimbursement_deleted',
    'participant_renamed',
    'participant_deleted',
    'participants_merged',
    'participant_payment_changed',
    'participant_defaults_changed',
    'currency_changed',
];

/** Changes and deletions made by others after `since` (ms). */
export function changesSince(activities: readonly Activity[], since: number, myId: string | null): number {
    return activities.filter((a) => CHANGES.includes(a.action) && a.actor !== myId && activityTime(a) > since).length;
}

/**
 * When I last looked at what changed in a group, on this device. The first
 * time, now: what happened before is not news.
 */
export function activitySeenAt(kimpayId: string): number {
    const key = `${STORAGE_KEYS.ACTIVITY_SEEN_PREFIX}${kimpayId}`;
    const saved = Number(prefs.get(key));
    if (saved > 0) return saved;
    const now = Date.now();
    prefs.set(key, String(now));
    return now;
}

export function markActivitySeen(kimpayId: string): number {
    const now = Date.now();
    prefs.set(`${STORAGE_KEYS.ACTIVITY_SEEN_PREFIX}${kimpayId}`, String(now));
    return now;
}
