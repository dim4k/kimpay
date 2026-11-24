import { haptic } from './haptic.js';

/** The phone's share sheet exists (phones, some desktop browsers). */
export function canShareNatively(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.share;
}

/** Copies a link; false when the browser refused. */
export async function copyLink(link: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(link);
        haptic('light');
        return true;
    } catch (err) {
        console.error('Failed to copy', err);
        return false;
    }
}

/** Opens the phone's share sheet (closing it is not an error). */
export async function shareNatively(data: ShareData): Promise<void> {
    try {
        await navigator.share(data);
    } catch {
        // Share sheet dismissed.
    }
}
