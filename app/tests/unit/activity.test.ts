import { describe, it, expect } from 'vitest';
import { changesSince, type Activity } from '../../src/lib/services/activity';

const line = (action: Activity['action'], actor: string, created: string): Activity =>
    ({ id: created, action, actor, actor_name: actor, target: '', data: {}, created }) as Activity;

describe('changes since my last look', () => {
    const since = new Date('2026-10-12T10:00:00Z').getTime();
    const activities = [
        line('expense_updated', 'bob', '2026-10-12 11:00:00.000Z'),
        line('expense_deleted', 'bob', '2026-10-12 12:00:00.000Z'),
        line('expense_updated', 'me', '2026-10-12 12:00:00.000Z'),
        line('expense_created', 'bob', '2026-10-12 12:00:00.000Z'),
        line('expense_updated', 'bob', '2026-10-12 09:00:00.000Z'),
    ];

    it("counts the others' changes and deletions after that moment", () => {
        expect(changesSince(activities, since, 'me')).toBe(2);
    });

    it('counts unknown authors as others', () => {
        expect(changesSince([line('participant_renamed', '', '2026-10-12 11:00:00.000Z')], since, 'me')).toBe(1);
    });
});
