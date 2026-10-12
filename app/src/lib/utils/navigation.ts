import { goto } from '$app/navigation';

/**
 * Whether the page before the current one in the history is a page of the app
 * (not a direct link or a reload). Group tabs replace their history entry, so
 * this is the page a sub-page (expense form) was opened from.
 */
let previousInApp = false;

/** Called by the root layout after every navigation. */
export function trackNavigation({ from, type }: { from: unknown; type: string }): void {
    previousInApp = from !== null && type !== 'enter';
}

/**
 * Leave a sub-page the way it was entered: back in the history when it was
 * opened from within the app, otherwise to `fallback` (replacing this page,
 * so the back gesture does not return to it).
 */
export async function goBack(fallback: string): Promise<void> {
    if (previousInApp) history.back();
    else await goto(fallback, { replaceState: true });
}
