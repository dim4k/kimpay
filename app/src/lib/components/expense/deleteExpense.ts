import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { t } from '$lib/i18n';
import { modals } from '$lib/stores/modals.svelte';
import { toasts } from '$lib/stores/toasts.svelte';
import { getErrorMessage } from '$lib/utils/errors';
import { haptic } from '$lib/utils/haptic';
import type { ActiveKimpay } from '$lib/stores/activeKimpay.svelte';

/**
 * Ask for confirmation, then delete an expense (optimistically) with
 * success / error feedback.
 *
 * @param navigateTo Page to leave to before deleting (e.g. from the edit
 *                   page of that expense, which would otherwise show it as
 *                   missing). On failure the expense is restored there.
 */
export function confirmDeleteExpense(
    activeKimpay: ActiveKimpay,
    expenseId: string,
    navigateTo?: string,
) {
    const translate = get(t);
    modals.confirm({
        title: translate('modal.delete_expense.title'),
        description: translate('modal.delete_expense.desc'),
        confirmText: translate('modal.delete_expense.confirm'),
        cancelText: translate('common.cancel'),
        variant: 'destructive',
        onConfirm: async () => {
            if (navigateTo) await goto(navigateTo);
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
