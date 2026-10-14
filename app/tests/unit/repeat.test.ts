import { describe, it, expect } from 'vitest';
import { anchoredDate, nextRepeatDate, repeatFrequency } from '../../src/lib/repeat';

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

    it('every week or two, on the weekday of the expense', () => {
        expect(nextRepeatDate('2026-10-14', 14, '2026-10-14', 'week')).toBe('2026-10-21');
        expect(nextRepeatDate('2026-10-14', 14, '2026-10-21', 'week')).toBe('2026-10-28');
        expect(nextRepeatDate('2026-10-14', 14, '2026-10-14', 'two_weeks')).toBe('2026-10-28');
        expect(nextRepeatDate('2026-12-28', 28, '2026-12-28', 'week')).toBe('2027-01-04');
    });

    it('starts after today for an old weekly expense, on its weekday', () => {
        // A Wednesday: the next Wednesday after today.
        expect(nextRepeatDate('2026-01-07', 7, '2026-10-15', 'week')).toBe('2026-10-21');
        expect(nextRepeatDate('2026-01-07', 7, '2026-10-15', 'two_weeks')).toBe('2026-10-28');
    });

    it('every quarter or year, on its day', () => {
        expect(nextRepeatDate('2026-11-30', 30, '2026-11-30', 'quarter')).toBe('2027-02-28');
        expect(nextRepeatDate('2027-02-28', 30, '2027-02-28', 'quarter')).toBe('2027-05-30');
        expect(nextRepeatDate('2026-03-14', 14, '2026-10-20', 'quarter')).toBe('2026-12-14');
        expect(nextRepeatDate('2028-02-29', 29, '2028-02-29', 'year')).toBe('2029-02-28');
        expect(nextRepeatDate('2025-06-01', 1, '2026-10-15', 'year')).toBe('2027-06-01');
    });

    it('reads an unknown frequency as every month', () => {
        expect(repeatFrequency('')).toBe('month');
        expect(repeatFrequency(undefined)).toBe('month');
        expect(repeatFrequency('quarter')).toBe('quarter');
    });
});
