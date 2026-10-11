/**
 * Error handling utilities for distinguishing network errors from server errors.
 */

/**
 * Check if an error is a network/connectivity error (status 0 or offline).
 * A request cancelled by the client (PocketBase auto-cancellation) also has
 * status 0 but is not a connectivity issue.
 */
export function isNetworkError(e: unknown): boolean {
    const error = e as { status?: number; isAbort?: boolean } | null;
    if (error?.isAbort) return false;
    return error?.status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine);
}

import type { TranslationKey } from '#lib/locales/en.js';

/**
 * Get a user-friendly error message based on the error type.
 * @param e - The error object
 * @param t - Translation function
 * @returns Translated error message
 */
export function getErrorMessage(e: unknown, t: (key: TranslationKey) => string): string {
    if (isNetworkError(e)) {
        return t('error.network');
    }
    return t('error.generic');
}
