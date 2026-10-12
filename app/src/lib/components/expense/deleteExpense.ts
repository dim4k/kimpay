import { get } from 'svelte/store';
import { t } from '#lib/i18n.js';
import { modals } from '#lib/stores/modals.svelte.js';
import { toasts } from '#lib/stores/toasts.svelte.js';
import { getErrorMessage } from '#lib/utils/errors.js';
import { haptic } from '#lib/utils/haptic.js';
import type { ActiveKimpay } from '#lib/stores/activeKimpay.svelte.js';

/**
 * Ask for confirmation, then delete an expense (optimistically) with
 * success / error feedback.
 *
 * @param leave Leaves the page before deleting (e.g. the edit page of that
 *              expense, which would otherwise show it as missing). On failure
 *              the expense is restored where the user went.
 */
export function confirmDeleteExpense(
    activeKimpay: ActiveKimpay,
    expenseId: string,
    leave?: () => Promise<void>,
) {
    const translate = get(t);
    modals.confirm({
        title: translate('modal.delete_expense.title'),
        description: translate('modal.delete_expense.desc'),
        confirmText: translate('modal.delete_expense.confirm'),
        cancelText: translate('common.cancel'),
        variant: 'destructive',
        onConfirm: async () => {
            await leave?.();
            try {
                await activeKimpay.deleteExpense(expenseId);
                haptic('success');
                toasts.success(translate('toast.expense_deleted'));
            } catch (e) {
                console.error('Failed to delete expense', e);
                haptic('error');
                toasts.error(getErrorMessage(e, translate));
            }
        },
    });
}
