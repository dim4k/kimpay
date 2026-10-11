/**
 * Expense dates are calendar dates ("YYYY-MM-DD", stored by PocketBase as
 * UTC midnight). They must be read and written as *local* calendar dates:
 * going through `toISOString()` / `new Date("YYYY-MM-DD")` shifts them by a
 * day around midnight or in negative-offset timezones.
 */

/** A date as "YYYY-MM-DD" in the user's timezone (defaults to today). */
export function toLocalISODate(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse "YYYY-MM-DD" (or a PocketBase datetime starting with it) as local
 * midnight of that calendar day.
 */
export function parseLocalISODate(value: string): Date {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
