/**
 * Repeated expenses (rent, subscriptions, a weekly basket): copied by the
 * server every week, two weeks, month, quarter or year, see
 * pocketbase/pb_hooks/lib/repeat.js, which follows the same rule.
 * Monthly frequencies fall on `repeat_day` (the last day of shorter months),
 * weekly ones on the weekday of the expense.
 * Dates are calendar days, "YYYY-MM-DD".
 */

export const REPEAT_FREQUENCIES = ['week', 'two_weeks', 'month', 'quarter', 'year'] as const;
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];

/** Days between two copies (weeks), or months (the others). */
const STEPS: Record<RepeatFrequency, { days?: number; months?: number }> = {
    week: { days: 7 },
    two_weeks: { days: 14 },
    month: { months: 1 },
    quarter: { months: 3 },
    year: { months: 12 },
};

const DAY_MS = 86_400_000;

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** The frequency of an expense set to repeat (monthly when not said, as before there was a choice). */
export function repeatFrequency(every: string | undefined): RepeatFrequency {
    return (REPEAT_FREQUENCIES as readonly string[]).includes(every ?? '') ? (every as RepeatFrequency) : 'month';
}

/** `day` in a month, or its last day when the month is shorter ("YYYY-MM-DD"). */
export function anchoredDate(year: number, month: number, day: number): string {
    const y = year + Math.floor(month / 12);
    const m = ((month % 12) + 12) % 12;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return `${y}-${pad(m + 1)}-${pad(Math.min(day, last))}`;
}

/**
 * The next copy: the first date of the series after `from` (the expense's
 * date) and after `today`. Only dates to come, never the past ones (an old
 * expense set to repeat starts at the next one).
 */
export function nextRepeatDate(from: string, day: number, today: string, every: RepeatFrequency = 'month'): string {
    const step = STEPS[every];
    if (step.days) {
        const start = Date.parse(`${from}T00:00:00Z`);
        const late = Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - start) / DAY_MS));
        const count = Math.floor(late / step.days) + 1;
        return new Date(start + count * step.days * DAY_MS).toISOString().slice(0, 10);
    }
    const year = Number(from.slice(0, 4));
    const month = Number(from.slice(5, 7)) - 1;
    for (let i = 1; i < 1200; i++) {
        const candidate = anchoredDate(year, month + i * step.months!, day);
        if (candidate > from && candidate > today) return candidate;
    }
    return '';
}
