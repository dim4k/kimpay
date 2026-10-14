import { describe, it, expect } from 'vitest';
import { dayLabel, groupByDay, weekdayLabels } from '../../src/lib/utils/date';

const words = { today: 'Today', yesterday: 'Yesterday' };
const now = new Date(2026, 9, 12, 15, 0);

describe('expense days', () => {
    it('names today and yesterday, then the date', () => {
        expect(dayLabel('2026-10-12', 'en', words, false, now)).toBe('Today');
        expect(dayLabel('2026-10-11', 'en', words, false, now)).toBe('Yesterday');
        expect(dayLabel('2026-10-03', 'en', words, true, now)).toBe('Sat, Oct 3');
        expect(dayLabel('2025-10-03', 'en', words, true, now)).toContain('2025');
    });

    it('groups consecutive items of a day, in their order', () => {
        const items = [{ date: '2026-10-12 00:00:00.000Z', n: 1 }, { date: '2026-10-12', n: 2 }, { date: '2026-10-10', n: 3 }];
        expect(groupByDay(items).map((d) => [d.key, d.items.map((i) => i.n)])).toEqual([
            ['2026-10-12', [1, 2]],
            ['2026-10-10', [3]],
        ]);
    });

    it.each(['en', 'fr', 'de', 'es', 'pt'])('names the 7 weekdays apart in %s, Monday first', (locale) => {
        const labels = weekdayLabels(locale);
        expect(new Set(labels.map((d) => d.short)).size).toBe(7);
        expect(labels[0]!.long).toBe(new Date(2024, 0, 1).toLocaleDateString(locale, { weekday: 'long' }));
    });
});
