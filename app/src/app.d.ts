// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { ExpenseSheetState } from '#lib/expenseSheet.js';

declare global {
    const __APP_VERSION__: string;
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        interface PageState {
            /** The expense form, open in a sheet over the group's pages */
            expenseSheet?: ExpenseSheetState;
            /** Just created from the home page: its emoji jumps in the header */
            justCreated?: boolean;
        }
        // interface Platform {}
    }
}

export {};
