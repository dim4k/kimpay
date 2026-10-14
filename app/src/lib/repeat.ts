/**
 * Expenses repeated every month (rent, subscriptions): copied by the server
 * on `repeat_day` of each month (the last day of shorter months), see
 * pocketbase/pb_hooks/lib/repeat.js, which follows the same rule.
 * Dates are calendar days, "YYYY-MM-DD".
 */

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** `day` in a month, or its last day when the month is shorter ("YYYY-MM-DD"). */
export function anchoredDate(year: number, month: number, day: number): string {
    const y = year + Math.floor(month / 12);
    const m = ((month % 12) + 12) % 12;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return `${y}-${pad(m + 1)}-${pad(Math.min(day, last))}`;
}

/**
 * The next copy: the first date on `day` of a month after `from` (the
 * expense's date) and after `today`. Only months to come, never the past
 * ones (an old expense set to repeat starts next month).
 */
export function nextRepeatDate(from: string, day: number, today: string): string {
    const year = Number(from.slice(0, 4));
    const month = Number(from.slice(5, 7)) - 1;
    for (let i = 1; i < 1200; i++) {
        const candidate = anchoredDate(year, month + i, day);
        if (candidate > from && candidate > today) return candidate;
    }
    return '';
}
