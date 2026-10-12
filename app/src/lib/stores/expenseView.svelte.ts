import { STORAGE_KEYS } from "#lib/constants.js";
import { prefs } from "#lib/utils/prefs.js";

/**
 * What the amounts say, on the expense list and the balance page alike:
 * what the group spent (`total`), or what it changes for me (`me`).
 * Remembered on this device; "for me" by default.
 */
export type ExpenseView = "total" | "me";

class ExpenseViewStore {
    choice = $state<ExpenseView>(prefs.get(STORAGE_KEYS.EXPENSE_VIEW) === "total" ? "total" : "me");

    set(value: ExpenseView) {
        this.choice = value;
        prefs.set(STORAGE_KEYS.EXPENSE_VIEW, value);
    }
}

export const expenseView = new ExpenseViewStore();
