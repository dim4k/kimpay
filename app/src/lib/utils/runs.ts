/**
 * A list cut where reimbursements start and stop, in its own order: the
 * expenses in between share a card, each reimbursement has its own (see
 * ExpenseItem). `key` is the first item's id.
 */
export function expenseRuns<T extends { id: string; is_reimbursement: boolean }>(
    items: readonly T[],
): { key: string; reimbursement: boolean; items: T[] }[] {
    const runs: { key: string; reimbursement: boolean; items: T[] }[] = [];
    for (const item of items) {
        const last = runs[runs.length - 1];
        if (last && last.reimbursement === item.is_reimbursement) last.items.push(item);
        else runs.push({ key: item.id, reimbursement: item.is_reimbursement, items: [item] });
    }
    return runs;
}
