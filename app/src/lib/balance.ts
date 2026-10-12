import type { Expense, Participant } from './types';
import { convert, DEFAULT_CURRENCY } from './services/currency';
import { distribute, fromMinor, splitWeights, toMinor } from './split';

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
 * What an expense means for one participant, in the expense currency:
 * positive = they advanced money for others (they are owed that much),
 * negative = their share paid by someone else (they owe that much),
 * 0 = not concerned, or they paid exactly their own share.
 * Reimbursements are left out (always 0): they settle debts, they do not
 * create any.
 */
export function expenseImpact(expense: Expense, participantId: string, participantIds: string[]): number {
    if (expense.is_reimbursement) return 0;
    const currency = expense.currency || DEFAULT_CURRENCY;
    const amount = toMinor(expense.amount, currency);
    const shares = distribute(amount, splitWeights(expense, participantIds));
    if (Object.keys(shares).length === 0) return 0;

    const paid = expense.payer === participantId ? amount : 0;
    const sign = expense.is_income ? -1 : 1;
    return fromMinor(sign * (paid - (shares[participantId] ?? 0)), currency);
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
        const share = distribute(amount, splitWeights(expense, ids))[participantId] ?? 0;
        minor += expense.is_income ? -share : share;
    }
    return fromMinor(minor, kimpayCurrency);
}

/** Net balances in minor units of the Kimpay currency (see calculateBalances). */
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
        const shares = distribute(amount, splitWeights(expense, ids));
        if (Object.keys(shares).length === 0) continue;

        // An expense: the payer advanced the money, everyone involved owes
        // their share. Money received by the group works the other way round.
        const sign = expense.is_income ? -1 : 1;
        if (balances[expense.payer] !== undefined) balances[expense.payer]! += sign * amount;
        for (const [id, share] of Object.entries(shares)) balances[id]! -= sign * share;
    }

    return balances;
}

/**
 * Calculate the net balance of each participant, in the Kimpay's currency.
 * Amounts are converted with each expense's frozen rate (see toKimpayAmount)
 * and shared without rounding drift: the sum of all balances is exactly 0.
 *
 * Positive = is owed money, Negative = owes money.
 *
 * This is the single source of truth for balances: {@link calculateDebts}
 * builds on top of it.
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
    const minor = balancesInMinor(expenses, participants, kimpayCurrency, rates);
    return Object.fromEntries(Object.entries(minor).map(([id, value]) => [id, fromMinor(value, kimpayCurrency)]));
}

/**
 * Suggested payments to settle all balances, in the Kimpay's currency.
 * Greedy matching of the largest debtor with the largest creditor, which
 * keeps the number of payments low.
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
    const balances = balancesInMinor(expenses, participants, kimpayCurrency, rates);

    // Separate into debtors and creditors (integer minor units: no float drift).
    // A single cent is left alone: older reimbursements were rounded
    // differently, and nobody wants to settle 0.01.
    const debtors: Balance[] = [];
    const creditors: Balance[] = [];
    for (const [id, amount] of Object.entries(balances)) {
        if (amount < -1) debtors.push({ participantId: id, amount });
        else if (amount > 1) creditors.push({ participantId: id, amount });
    }

    // Sort by magnitude to optimize matching
    debtors.sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount); // Descending (most positive first)

    const transactions: Transaction[] = [];

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i]!;
        const creditor = creditors[j]!;

        // The amount to settle is the minimum of what debtor owes and creditor is owed
        const amount = Math.min(-debtor.amount, creditor.amount);
        transactions.push({
            from: debtor.participantId,
            to: creditor.participantId,
            amount: fromMinor(amount, kimpayCurrency),
            currency: kimpayCurrency
        });

        debtor.amount += amount;
        creditor.amount -= amount;

        // If settled (give or take the cent ignored above), move to next
        if (debtor.amount >= -1) i++;
        if (creditor.amount <= 1) j++;
    }

    return transactions;
}
