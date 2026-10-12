import type { Expense } from './types';
import { expenseShare, isSettled, toKimpayAmount } from './balance';
import { EMOJI_CATEGORY_ORDER, emojiCategory, type EmojiCategoryKey } from './constants';

/** Spending (expenses minus money received), never reimbursements. */
const spending = (expenses: Expense[]) => expenses.filter((e) => !e.is_reimbursement);

/**
 * What the group spent per category, or my part of it when `participantId`
 * is given, in the Kimpay's currency. Biggest first; categories that end up
 * at zero or below (money received) are left out.
 */
export function spendingByCategory(
    expenses: Expense[],
    kimpayCurrency: string,
    rates: Record<string, number>,
    participantIds: string[],
    participantId?: string,
): { key: EmojiCategoryKey; amount: number }[] {
    const totals = new Map<EmojiCategoryKey, number>();
    for (const e of spending(expenses)) {
        if (e.amount <= 0) continue;
        const value = toKimpayAmount(e, kimpayCurrency, rates);
        const part = participantId ? (expenseShare(e, participantId, participantIds) / e.amount) * value : value;
        if (!part) continue;
        const key = emojiCategory(e.icon);
        totals.set(key, (totals.get(key) ?? 0) + (e.is_income ? -part : part));
    }
    return [...totals]
        .map(([key, amount]) => ({ key, amount }))
        .filter((c) => c.amount > 0 && !isSettled(c.amount))
        .sort((a, b) => b.amount - a.amount || EMOJI_CATEGORY_ORDER.indexOf(a.key) - EMOJI_CATEGORY_ORDER.indexOf(b.key));
}

export interface GroupStats {
    /** Net spending per day, over the days from the first to the last expense */
    perDay: number;
    days: number;
    biggest: Expense | null;
    /** Its value in the Kimpay's currency */
    biggestAmount: number;
    /** Who advanced the most, with what they advanced */
    topPayer: { id: string; amount: number } | null;
    expenseCount: number;
    reimbursementCount: number;
}

/** A few figures about the group, in the Kimpay's currency. */
export function groupStats(expenses: Expense[], kimpayCurrency: string, rates: Record<string, number>): GroupStats {
    const items = spending(expenses);
    let total = 0;
    let biggest: Expense | null = null;
    let biggestAmount = 0;
    const paid = new Map<string, number>();
    let first = '';
    let last = '';
    for (const e of items) {
        const value = toKimpayAmount(e, kimpayCurrency, rates);
        const day = e.date.slice(0, 10);
        if (!first || day < first) first = day;
        if (!last || day > last) last = day;
        if (e.is_income) {
            total -= value;
            continue;
        }
        total += value;
        if (value > biggestAmount) {
            biggest = e;
            biggestAmount = value;
        }
        paid.set(e.payer, (paid.get(e.payer) ?? 0) + value);
    }
    // Calendar days, both ends included (dates are local, "YYYY-MM-DD").
    const days = first ? Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000) + 1 : 0;
    const top = [...paid].sort((a, b) => b[1] - a[1])[0];
    return {
        perDay: days ? total / days : 0,
        days,
        biggest,
        biggestAmount,
        topPayer: top ? { id: top[0], amount: top[1] } : null,
        expenseCount: items.length,
        reimbursementCount: expenses.length - items.length,
    };
}
