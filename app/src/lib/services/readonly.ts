import { pb } from '#lib/pocketbase.js';
import type { Expense, ExpenseSplit, Participant } from '#lib/types.js';

/** What the read-only endpoint returns (participants are "p0", "p1"... refs). */
interface ReadonlyResponse {
    kimpay: { name: string; icon: string; currency: string };
    participants: { ref: string; name: string }[];
    expenses: {
        description: string;
        amount: number;
        currency: string;
        exchange_rate: number;
        date: string;
        icon: string;
        payer: string;
        involved: string[];
        split: ExpenseSplit | null;
        is_reimbursement: boolean;
        is_income: boolean;
    }[];
}

export interface ReadonlyKimpay {
    name: string;
    icon: string;
    currency: string;
    participants: Participant[];
    expenses: Expense[];
}

/**
 * Load a Kimpay through its read-only link. Records come back as the usual
 * domain types (participant IDs being the opaque refs), so balances are
 * computed with the same code as the app.
 */
export async function fetchReadonlyKimpay(token: string): Promise<ReadonlyKimpay> {
    const data = await pb.send<ReadonlyResponse>(`/api/readonly/${encodeURIComponent(token)}`, { method: 'GET' });

    const participants = data.participants.map(
        (p) => ({ id: p.ref, name: p.name, kimpay: '' }) as Participant,
    );
    const byId = new Map(participants.map((p) => [p.id, p]));

    const expenses = data.expenses.map(
        (e, i) =>
            ({
                ...e,
                id: `e${i}`,
                kimpay: '',
                created: '',
                updated: '',
                created_by: '',
                expand: {
                    payer: byId.get(e.payer),
                    involved: e.involved.map((id) => byId.get(id)).filter((p): p is Participant => !!p),
                },
            }) as Expense,
    );

    return { ...data.kimpay, participants, expenses };
}
