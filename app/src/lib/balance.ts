import type { Expense, Participant } from './types';
import { convert, DEFAULT_CURRENCY } from './services/currency';
import { distribute, exactShares, fromMinor, roundToSum, splitWeights, toMinor } from './split';

/**
 * A single minor unit (cent) is never worth a payment: indivisible cents
 * leave such leftovers (older reimbursements were also rounded differently),
 * and nobody wants to settle 0.01.
 */
const DUST = 1;

export interface Transaction {
    from: string;
    to: string;
    amount: number;
    currency: string;
}

export interface Balance {
    participantId: string;
    amount: number; // Positive = owns money, Negative = owes money
}

/** Less than half a cent: what conversions leave behind, worth nothing. */
const EPSILON = 0.005;

/** Owed money, owes money, or settled. */
export type BalanceTone = 'success' | 'warning' | 'neutral';

/** An amount (a balance, an impact...) small enough to mean "settled". */
export function isSettled(amount: number): boolean {
    return Math.abs(amount) < EPSILON;
}

/** `success` when owed money, `warning` when owing it, `neutral` when settled. */
export function balanceTone(amount: number): BalanceTone {
    if (isSettled(amount)) return 'neutral';
    return amount > 0 ? 'success' : 'warning';
}

/** "+" when owed money, "−" when owing it, nothing when settled. */
export function balanceSign(amount: number): string {
    if (isSettled(amount)) return '';
    return amount > 0 ? '+' : '−';
}

/**
 * Value of an expense in the Kimpay's currency: converted with the rate
 * frozen at the expense date when known, with today's rate otherwise
 * (expenses created before rates were stored, or offline).
 *
 * @param rates - Today's exchange rates from getExchangeRates() (base: EUR)
 */
export function toKimpayAmount(
    expense: Pick<Expense, 'amount' | 'currency' | 'exchange_rate'>,
    kimpayCurrency: string,
    rates: Record<string, number>,
): number {
    const currency = expense.currency || DEFAULT_CURRENCY;
    if (currency === kimpayCurrency) return expense.amount;
    if (expense.exchange_rate && expense.exchange_rate > 0) {
        return fromMinor(toMinor(expense.amount * expense.exchange_rate, kimpayCurrency), kimpayCurrency);
    }
    return convert(expense.amount, currency, kimpayCurrency, rates);
}

/**
 * Net spending of the group: expenses minus money received, reimbursements
 * excluded. In the Kimpay's currency.
 */
export function totalSpent(expenses: Expense[], kimpayCurrency: string, rates: Record<string, number>): number {
    const minor = expenses.reduce((sum, e) => {
        if (e.is_reimbursement) return sum;
        const value = toMinor(toKimpayAmount(e, kimpayCurrency, rates), kimpayCurrency);
        return sum + (e.is_income ? -value : value);
    }, 0);
    return fromMinor(minor, kimpayCurrency);
}

/**
 * What one participant advanced for the group: the expenses they paid minus
 * the money they received for it, reimbursements excluded. In the Kimpay's
 * currency (the counterpart of shareOf).
 */
export function paidBy(expenses: Expense[], participantId: string, kimpayCurrency: string, rates: Record<string, number>): number {
    return totalSpent(expenses.filter((e) => e.payer === participantId), kimpayCurrency, rates);
}

/**
 * One participant's part of a single expense (or of money received), in the
 * expense currency: 0 when they are not involved. Reimbursements have none.
 */
export function expenseShare(expense: Expense, participantId: string, participantIds: string[]): number {
    if (expense.is_reimbursement) return 0;
    const currency = expense.currency || DEFAULT_CURRENCY;
    const shares = distribute(toMinor(expense.amount, currency), splitWeights(expense, participantIds));
    return fromMinor(shares[participantId] ?? 0, currency);
}

/**
 * What one expense changes to a participant's balance, in the expense
 * currency: what they advanced minus their share (the other way round for
 * money received). Positive: they are owed money; negative: they owe it.
 * null for reimbursements (their line already says who paid whom), undefined
 * when the expense does not concern them.
 */
export function expenseImpact(expense: Expense, participantId: string, participantIds: string[]): number | null | undefined {
    if (expense.is_reimbursement) return null;
    const paid = expense.payer === participantId;
    const involved = (expense.involved ?? []).includes(participantId);
    if (!paid && !involved) return undefined;
    const share = involved ? expenseShare(expense, participantId, participantIds) : 0;
    return (expense.is_income ? -1 : 1) * ((paid ? expense.amount : 0) - share);
}

/**
 * One participant's share of the group's spending (expenses minus money
 * received, reimbursements excluded), in the Kimpay's currency.
 */
export function shareOf(
    expenses: Expense[],
    participants: Participant[],
    participantId: string,
    kimpayCurrency: string,
    rates: Record<string, number>,
): number {
    const ids = participants.map((p) => p.id);
    let minor = 0;
    for (const expense of expenses) {
        if (expense.is_reimbursement) continue;
        const amount = toMinor(toKimpayAmount(expense, kimpayCurrency, rates), kimpayCurrency);
        const share = exactShares(amount, splitWeights(expense, ids))[participantId] ?? 0;
        minor += expense.is_income ? -share : share;
    }
    return fromMinor(Math.round(minor), kimpayCurrency);
}

/**
 * Net balances in minor units of the Kimpay currency (see calculateBalances).
 * Shares are added up exactly, then rounded once, so the indivisible cents of
 * each expense do not pile up on anyone.
 */
function balancesInMinor(
    expenses: Expense[],
    participants: Participant[],
    kimpayCurrency: string,
    rates: Record<string, number>,
): Record<string, number> {
    const ids = participants.map((p) => p.id);
    const balances: Record<string, number> = {};
    ids.forEach((id) => (balances[id] = 0));

    for (const expense of expenses) {
        const amount = toMinor(toKimpayAmount(expense, kimpayCurrency, rates), kimpayCurrency);
        const shares = exactShares(amount, splitWeights(expense, ids));
        if (Object.keys(shares).length === 0) continue;

        // An expense: the payer advanced the money, everyone involved owes
        // their share. Money received by the group works the other way round.
        const sign = expense.is_income ? -1 : 1;
        if (balances[expense.payer] !== undefined) balances[expense.payer]! += sign * amount;
        for (const [id, share] of Object.entries(shares)) balances[id]! -= sign * share;
    }

    return roundToSum(balances, 0);
}

/** A suggested payment, in minor units of the Kimpay currency. */
interface MinorPayment {
    from: string;
    to: string;
    amount: number;
}

/**
 * Payments settling the balances: greedy matching of the largest debtor with
 * the largest creditor, which keeps the number of payments low. A single
 * cent is left alone (see DUST).
 */
function settle(balances: Record<string, number>): MinorPayment[] {
    // Integer minor units: no float drift.
    const debtors: Balance[] = [];
    const creditors: Balance[] = [];
    for (const [id, amount] of Object.entries(balances)) {
        if (amount < -DUST) debtors.push({ participantId: id, amount });
        else if (amount > DUST) creditors.push({ participantId: id, amount });
    }

    // Sort by magnitude to optimize matching
    debtors.sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount); // Descending (most positive first)

    const payments: MinorPayment[] = [];

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i]!;
        const creditor = creditors[j]!;

        // The amount to settle is the minimum of what debtor owes and creditor is owed
        const amount = Math.min(-debtor.amount, creditor.amount);
        payments.push({ from: debtor.participantId, to: creditor.participantId, amount });

        debtor.amount += amount;
        creditor.amount -= amount;

        // If settled (give or take the cent ignored above), move to next
        if (debtor.amount >= -DUST) i++;
        if (creditor.amount <= DUST) j++;
    }

    return payments;
}

/**
 * Calculate the net balance of each participant, in the Kimpay's currency:
 * what they will receive (positive) or pay (negative) through the suggested
 * payments of {@link calculateDebts}, so both always agree. Leftover cents
 * that no payment can settle (see DUST) count as settled.
 *
 * Amounts are converted with each expense's frozen rate (see toKimpayAmount)
 * and shared without rounding drift: the sum of all balances is exactly 0.
 *
 * @param expenses - List of expenses
 * @param participants - List of participants
 * @param kimpayCurrency - The Kimpay's currency
 * @param rates - Today's exchange rates from getExchangeRates() (base: EUR)
 */
export function calculateBalances(
    expenses: Expense[],
    participants: Participant[],
    kimpayCurrency: string = DEFAULT_CURRENCY,
    rates: Record<string, number> = {}
): Record<string, number> {
    const balances = balancesInMinor(expenses, participants, kimpayCurrency, rates);
    const net: Record<string, number> = Object.fromEntries(Object.keys(balances).map((id) => [id, 0]));
    for (const { from, to, amount } of settle(balances)) {
        net[from]! -= amount;
        net[to]! += amount;
    }
    return Object.fromEntries(Object.entries(net).map(([id, value]) => [id, fromMinor(value, kimpayCurrency)]));
}

/**
 * Suggested payments to settle all balances, in the Kimpay's currency.
 *
 * @param expenses - List of expenses
 * @param participants - List of participants
 * @param kimpayCurrency - The Kimpay's currency
 * @param rates - Today's exchange rates from getExchangeRates() (base: EUR)
 */
export function calculateDebts(
    expenses: Expense[],
    participants: Participant[],
    kimpayCurrency: string = DEFAULT_CURRENCY,
    rates: Record<string, number> = {}
): Transaction[] {
    return settle(balancesInMinor(expenses, participants, kimpayCurrency, rates)).map(({ from, to, amount }) => ({
        from,
        to,
        amount: fromMinor(amount, kimpayCurrency),
        currency: kimpayCurrency,
    }));
}
