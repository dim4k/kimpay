import { describe, it, expect } from 'vitest';
import { expenseRuns } from '../../src/lib/utils/runs';

const item = (id: string, is_reimbursement = false) => ({ id, is_reimbursement });

describe('expenseRuns', () => {
    it('keeps the order, cutting where reimbursements start and stop', () => {
        const runs = expenseRuns([item('a'), item('b'), item('r1', true), item('r2', true), item('c')]);
        expect(runs.map((r) => [r.key, r.reimbursement, r.items.map((i) => i.id)])).toEqual([
            ['a', false, ['a', 'b']],
            ['r1', true, ['r1', 'r2']],
            ['c', false, ['c']],
        ]);
    });

    it('stays empty without items', () => {
        expect(expenseRuns([])).toEqual([]);
    });
});
