import { get } from 'svelte/store';
import { t } from '#lib/i18n.js';
import { modals } from '#lib/stores/modals.svelte.js';

/**
 * Leaving something that exists already (an expense, the group, payment
 * links) with changes not saved: save them, drop them, or stay. Without
 * `save` (what is typed cannot be saved as it is): drop them, or stay.
 */
export function confirmUnsaved({ save, discard }: { save?: (() => void | Promise<void>) | undefined; discard: () => void }): void {
    const translate = get(t);
    if (!save) {
        modals.confirm({
            title: translate('unsaved.discard_title'),
            description: translate('expense.form.discard_desc'),
            confirmText: translate('expense.form.discard'),
            cancelText: translate('unsaved.keep'),
            variant: 'destructive',
            onConfirm: discard,
        });
        return;
    }
    modals.confirm({
        title: translate('unsaved.title'),
        description: translate('unsaved.desc'),
        confirmText: translate('common.save'),
        cancelText: translate('unsaved.keep'),
        altText: translate('unsaved.discard'),
        onAlt: discard,
        onConfirm: save,
    });
}
