import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { t } from '#lib/i18n.js';
import { modals } from '#lib/stores/modals.svelte.js';

/** What the expense sheet shows: the form, or one of its panels. */
export type ExpenseView = 'main' | 'payer' | 'involved' | 'split' | 'date' | 'repeat' | 'note' | 'to';

/**
 * The expense form, open in a sheet over the group's pages (shallow
 * routing): the address is the form's, Back closes the sheet (or the panel
 * open in it).
 */
export interface ExpenseSheetState {
    /** The expense edited (none: a new one) */
    expenseId?: string;
    /** A new expense filled in from this one (duplicate) */
    from?: string;
    /** A new expense from a receipt: the photo button first (app icon's shortcut) */
    scan?: boolean;
    /** A panel of the form, over its summary */
    view?: ExpenseView;
    /** Tells two openings apart: each one gets a fresh form */
    key: number;
}

type Target = Pick<ExpenseSheetState, 'expenseId' | 'from' | 'scan'>;

/** The address of the form: still a page of its own on a reload or a link. */
export function expenseSheetUrl(kimpayId: string, { expenseId, from, scan }: Target): string {
    if (expenseId) return `/k/${kimpayId}/edit/${expenseId}`;
    if (from) return `/k/${kimpayId}/add?from=${encodeURIComponent(from)}`;
    return `/k/${kimpayId}/add${scan ? '?scan' : ''}`;
}

/**
 * Opens the form in a sheet, over the page shown. `replace`: in place of the
 * sheet open (a duplicate, from the expense it copies).
 */
export function openExpenseSheet(kimpayId: string, target: Target = {}, { replace = false } = {}): Promise<void> {
    const expenseSheet: ExpenseSheetState = { key: Date.now() };
    if (target.expenseId) expenseSheet.expenseId = target.expenseId;
    if (target.from) expenseSheet.from = target.from;
    if (target.scan) expenseSheet.scan = true;
    return goto(expenseSheetUrl(kimpayId, target), { shallow: true, replaceState: replace, state: { expenseSheet } });
}

/**
 * The click handler of a link to the form: a plain click opens the sheet,
 * the link itself still opens a new tab.
 */
export function opensExpenseSheet(kimpayId: string, target: Target = {}): (e: MouseEvent) => void {
    return (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openExpenseSheet(kimpayId, target);
    };
}

/**
 * The form's own address (a link, a reload): the expense list, with the
 * sheet open over it. Back then leaves the sheet for the list.
 */
export async function reopenExpenseSheet(kimpayId: string, target: Target): Promise<void> {
    await goto(`/k/${kimpayId}`, { replace: true });
    await openExpenseSheet(kimpayId, target);
}

/** Leaving the form with something typed: ask first. */
export function confirmDiscard(discard: () => void): void {
    const translate = get(t);
    modals.confirm({
        title: translate('expense.form.discard_title'),
        description: translate('expense.form.discard_desc'),
        confirmText: translate('expense.form.discard'),
        cancelText: translate('expense.form.keep_editing'),
        variant: 'destructive',
        onConfirm: discard,
    });
}
