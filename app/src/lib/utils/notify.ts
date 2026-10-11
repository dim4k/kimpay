import { get } from 'svelte/store';
import { t } from '#lib/i18n.js';
import { toasts } from '#lib/stores/toasts.svelte.js';
import { getErrorMessage } from '#lib/utils/errors.js';
import { haptic } from '#lib/utils/haptic.js';

/**
 * Report a failed user action: logs it (with `context`) and shows a
 * translated toast (network vs generic error) with error haptics.
 */
export function notifyError(error: unknown, context: string): void {
    console.error(context, error);
    haptic('error');
    toasts.error(getErrorMessage(error, get(t)));
}
