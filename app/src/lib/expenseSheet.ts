import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { page } from '$app/state';
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
    /**
     * History entries from the page under the sheet to this one (1 when
     * omitted), its panel not counted: another expense opened in place of
     * one (computers) keeps them, so closing still goes back to the page.
     */
    depth?: number;
}

/** The sheet on screen, for what acts on it from outside (the list, the keyboard). */
export interface ExpenseSheetControls {
    expenseId: string | undefined;
    hasChanges(): boolean;
    /** Closes it, asking first if something is typed */
    requestClose(): void;
    /** Closes it, whatever is typed */
    close(): void;
    /** The expense shown, deleted (asked first) */
    deleteShown: (() => void) | undefined;
}

export const expenseSheet: { controls: ExpenseSheetControls | null } = { controls: null };

/** Entries to go back to leave a sheet, its panel included. */
export function sheetDepth(sheet: ExpenseSheetState): number {
    return (sheet.depth ?? 1) + (sheet.view && sheet.view !== 'main' ? 1 : 0);
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
    const state: ExpenseSheetState = { key: Date.now() };
    if (target.expenseId) state.expenseId = target.expenseId;
    if (target.from) state.from = target.from;
    if (target.scan) state.scan = true;
    // A sheet already open (a panel beside the list, on computers): this one
    // takes its place, as deep in the history.
    const open = page.state.expenseSheet;
    if (open) {
        replace = true;
        state.depth = sheetDepth(open);
    }
    return goto(expenseSheetUrl(kimpayId, target), { shallow: true, replaceState: replace, state: { expenseSheet: state } });
}

/**
 * Another expense from the list while a sheet is open beside it
 * (computers): asked first if something is typed in the one open.
 */
export function showExpenseSheet(kimpayId: string, target: Target): void {
    const controls = expenseSheet.controls;
    if (controls && target.expenseId && controls.expenseId === target.expenseId) return;
    if (controls?.hasChanges()) confirmDiscard(() => openExpenseSheet(kimpayId, target));
    else openExpenseSheet(kimpayId, target);
}

/**
 * The click handler of a link to the form: a plain click opens the sheet,
 * the link itself still opens a new tab.
 */
export function opensExpenseSheet(kimpayId: string, target: Target = {}): (e: MouseEvent) => void {
    return (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        showExpenseSheet(kimpayId, target);
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
