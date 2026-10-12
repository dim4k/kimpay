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

/**
 * How long ago a moment was, by calendar day in the user's timezone: "today",
 * "yesterday", "3 days ago", then weeks, months and years. Accepts PocketBase
 * datetimes ("2026-10-12 08:30:00.000Z").
 */
export function relativeDay(timestamp: string, locale: string, now: Date = new Date()): string {
    const date = new Date(timestamp.replace(' ', 'T'));
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.max(0, Math.round((startOf(now) - startOf(date)) / 86_400_000));
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (days < 7) return format.format(-days, 'day');
    if (days < 30) return format.format(-Math.floor(days / 7), 'week');
    if (days < 365) return format.format(-Math.floor(days / 30), 'month');
    return format.format(-Math.floor(days / 365), 'year');
}

/**
 * A day of the expense lists ("YYYY-MM-DD"): "Today", "Yesterday", then the
 * date ("Saturday 19 September", "Sat 19 Sep" when `short`), with the year
 * when it is not this one.
 */
export function dayLabel(
    key: string,
    locale: string,
    words: { today: string; yesterday: string },
    short = false,
    now: Date = new Date(),
): string {
    if (key === toLocalISODate(now)) return words.today;
    if (key === toLocalISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return words.yesterday;
    return parseLocalISODate(key).toLocaleDateString(locale, {
        weekday: short ? 'short' : 'long',
        day: 'numeric',
        month: short ? 'short' : 'long',
        ...(key.slice(0, 4) !== String(now.getFullYear()) && { year: 'numeric' }),
    });
}

/** Items grouped by day ("YYYY-MM-DD" of their `date`), consecutive ones only: sort them first. */
export function groupByDay<T extends { date: string }>(items: readonly T[]): { key: string; items: T[] }[] {
    const days: { key: string; items: T[] }[] = [];
    for (const item of items) {
        const key = item.date.slice(0, 10);
        const last = days[days.length - 1];
        if (last?.key === key) last.items.push(item);
        else days.push({ key, items: [item] });
    }
    return days;
}
