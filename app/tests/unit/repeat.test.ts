import { describe, it, expect } from 'vitest';
import { anchoredDate, nextRepeatDate } from '../../src/lib/repeat';

describe('repeated expenses', () => {
    it('falls on the same day next month', () => {
        expect(nextRepeatDate('2026-10-14', 14, '2026-10-14')).toBe('2026-11-14');
    });

    it('starts after today for an old expense, without the past months', () => {
        expect(nextRepeatDate('2026-03-14', 14, '2026-10-20')).toBe('2026-11-14');
        expect(nextRepeatDate('2026-03-14', 14, '2026-10-10')).toBe('2026-10-14');
    });

    it('starts the month after an expense dated in the future', () => {
        expect(nextRepeatDate('2026-11-05', 5, '2026-10-20')).toBe('2026-12-05');
    });

    it('takes the last day of shorter months, and comes back to its day', () => {
        expect(nextRepeatDate('2026-01-31', 31, '2026-01-31')).toBe('2026-02-28');
        expect(nextRepeatDate('2026-02-28', 31, '2026-02-28')).toBe('2026-03-31');
        expect(anchoredDate(2028, 1, 30)).toBe('2028-02-29');
    });

    it('crosses the year', () => {
        expect(nextRepeatDate('2026-12-10', 10, '2026-12-10')).toBe('2027-01-10');
    });
});
