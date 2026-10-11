import type { Expense } from '#lib/types.js';

/**
 * The merchant part of a description, normalized: scanned receipts are
 * described as "Store - Category", so "Carrefour - Courses" and
 * "carrefour - groceries" both give "carrefour".
 */
export function merchantKey(description: string): string {
    return (description.split(' - ')[0] ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

/**
 * The most recent regular expense from the same merchant, whose participants
 * (and split) can be suggested for a newly scanned receipt.
 */
export function findSimilarExpense(expenses: Expense[], description: string): Expense | null {
    const key = merchantKey(description);
    if (key.length < 2) return null;

    let best: Expense | null = null;
    for (const e of expenses) {
        if (e.is_reimbursement || e.is_income || merchantKey(e.description) !== key) continue;
        if (!best || e.date > best.date || (e.date === best.date && e.created > best.created)) best = e;
    }
    return best;
}
