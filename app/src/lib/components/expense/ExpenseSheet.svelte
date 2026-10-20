<script lang="ts">
    import { untrack } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { LoaderCircle, SearchX } from '@lucide/svelte';
    import { t } from '#lib/i18n.js';
    import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
    import { confirmDiscard, expenseSheetUrl, openExpenseSheet, type ExpenseSheetState } from '#lib/expenseSheet.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { confirmDeleteExpense } from '#lib/components/expense/deleteExpense.js';
    import ExpenseForm from '#lib/components/ExpenseForm.svelte';
    import EmptyState from '#lib/components/ui/EmptyState.svelte';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';

    /**
     * The expense form, in a sheet over the group's pages, while the page
     * state holds `expenseSheet` (see openExpenseSheet).
     */
    let { kimpayId }: { kimpayId: string } = $props();

    const ctx = getActiveKimpayContext();
    let activeKimpay = $derived(ctx.value);

    let target = $derived(page.state.expenseSheet ?? null);
    // The sheet on screen: kept when Back leaves its history entry with
    // something typed, while asking whether to discard it.
    let shown = $state<ExpenseSheetState | null>(null);
    let form = $state<{ hasChanges(): boolean }>();
    // Saved, deleted or discarded: closes without asking.
    let leaving = $state(false);

    $effect(() => {
        const next = target;
        untrack(() => {
            if (next) {
                if (next.key !== shown?.key) leaving = false;
                shown = next;
            } else if (shown && form?.hasChanges() && !leaving) {
                // Back with something typed: the entry is put back, then the question.
                const kept: ExpenseSheetState = { ...shown, view: 'main' };
                goto(expenseSheetUrl(kimpayId, kept), { shallow: true, state: { expenseSheet: kept } });
                confirmDiscard(close);
            } else {
                shown = null;
            }
        });
    });

    /** Back to the page under the sheet (past the panel open, if any). */
    function close() {
        leaving = true;
        const sheet = page.state.expenseSheet;
        if (sheet) history.go(sheet.view && sheet.view !== 'main' ? -2 : -1);
        else shown = null;
    }

    function requestClose() {
        if (form?.hasChanges()) confirmDiscard(close);
        else close();
    }

    // The expense edited: found once the group is loaded (or fresher data arrives).
    let edited = $derived(shown?.expenseId ? activeKimpay?.expenses.find((e) => e.id === shown!.expenseId) ?? null : null);
    let isLoading = $derived(!edited && (activeKimpay?.loading ?? true));
    // A duplicate: a new expense filled in from that one.
    let template = $derived(
        shown?.from ? activeKimpay?.expenses.find((e) => e.id === shown!.from && !e.is_reimbursement) ?? null : null
    );

    function deleteEdited() {
        if (!activeKimpay || !edited) return;
        // The sheet leaves first: it would show the expense as missing otherwise.
        confirmDeleteExpense(activeKimpay, edited.id, async () => close());
    }

    /** The same again (breakfast, fuel...): a new expense, filled in, in place of this one. */
    function duplicateEdited() {
        if (!edited) return;
        const from = edited.id;
        const duplicate = () => {
            leaving = true;
            openExpenseSheet(kimpayId, { from }, { replace: true });
        };
        if (form?.hasChanges()) confirmDiscard(duplicate);
        else duplicate();
    }
</script>

{#if shown}
    {#key shown.key}
        {#if !shown.expenseId}
            <ExpenseForm {kimpayId} {template} scanFirst={!!shown.scan} title={$t('expense.add.title')} onClose={requestClose} onSaved={close} bind:this={form} />
        {:else if edited}
            <ExpenseForm
                {kimpayId}
                initialData={edited}
                title={$t('expense.edit.title')}
                onDelete={offlineStore.isOffline ? undefined : deleteEdited}
                onDuplicate={duplicateEdited}
                onClose={requestClose}
                onSaved={close}
                bind:this={form}
            />
        {:else}
            <Modal isOpen onClose={close} variant="sheet" label={$t('expense.edit.title')}>
                <ModalHeader title={$t('expense.edit.title')} align="start" onClose={close} />
                {#if isLoading}
                    <div class="flex justify-center py-8">
                        <LoaderCircle class="h-8 w-8 animate-spin text-primary" />
                    </div>
                {:else if !leaving}
                    <EmptyState title={$t('expense.not_found')} description={$t('expense.not_found_desc')}>
                        {#snippet icon()}
                            <SearchX class="h-12 w-12" />
                        {/snippet}
                    </EmptyState>
                {/if}
            </Modal>
        {/if}
    {/key}
{/if}
