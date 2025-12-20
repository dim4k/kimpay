import type { Expense, Participant } from './types';
import { convert, DEFAULT_CURRENCY } from './services/currency';

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
 * Calculate debts with multi-currency support.
 * All amounts are converted to the target currency before calculation.
 * 
 * @param expenses - List of expenses (with currency field)
 * @param participants - List of participants
 * @param targetCurrency - Currency to convert all amounts to (e.g., Kimpay's currency)
 * @param rates - Exchange rates from getExchangeRates() (base: EUR)
 */
export function calculateDebts(
    expenses: Expense[], 
    participants: Participant[],
    targetCurrency: string = DEFAULT_CURRENCY,
    rates: Record<string, number> = {}
): Transaction[] {
    const balances: Record<string, number> = {};

    // Initialize balances
    participants.forEach(p => balances[p.id] = 0);

    // Calculate net balance for each person
    for (const expense of expenses) {
        // Convert amount to target currency
        const expenseCurrency = expense.currency || DEFAULT_CURRENCY;
        const amount = convert(expense.amount, expenseCurrency, targetCurrency, rates);
        
        const payerId = expense.payer;
        
        // Who acts in this expense? (Default: everyone if 'involved' is empty)
        let involvedIds = expense.involved;
        if (!involvedIds || involvedIds.length === 0) {
            involvedIds = participants.map(p => p.id);
        }

        const splitAmount = amount / involvedIds.length;

        // Payer gets +Amount
        if (balances[payerId] !== undefined) {
             balances[payerId] += amount;
        }

        // Everyone involved gets -SplitAmount
        involvedIds.forEach((id: string) => {
            if (balances[id] !== undefined) {
                balances[id] -= splitAmount;
            }
        });
    }

    // Separate into debtors and creditors
    const debtors: Balance[] = [];
    const creditors: Balance[] = [];

    for (const [id, amount] of Object.entries(balances)) {
        // Fix floating point precision
        const rounded = Math.round(amount * 100) / 100;
        if (rounded < -0.01) debtors.push({ participantId: id, amount: rounded });
        else if (rounded > 0.01) creditors.push({ participantId: id, amount: rounded });
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
        let amount = Math.min(Math.abs(debtor.amount), creditor.amount);
        
        // Round to 2 decimals
        amount = Math.round(amount * 100) / 100;

        if (amount > 0) {
            transactions.push({
                from: debtor.participantId,
                to: creditor.participantId,
                amount: amount,
                currency: targetCurrency
            });
        }

        // Update remaining amounts
        debtor.amount += amount;
        creditor.amount -= amount;

        // If settled, move to next
        if (Math.abs(debtor.amount) < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return transactions;
}
