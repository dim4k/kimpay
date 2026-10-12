<script lang="ts">
  import { page } from '$app/state';
  import ExpenseForm from '#lib/components/ExpenseForm.svelte';
  import { confirmDeleteExpense } from '#lib/components/expense/deleteExpense.js';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { LoaderCircle, SearchX } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { goBack } from '#lib/utils/navigation.js';

  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpayId = $derived(activeKimpay?.id ?? '');
  let expenseId = $derived((page.params as Record<string, string>).expenseId);

  // Derived (not copied once): an expense missing from a stale cache shows up
  // as soon as fresh data arrives.
  let initialData = $derived(activeKimpay?.expenses.find(e => e.id === expenseId) ?? null);
  let isLoading = $derived(!initialData && (activeKimpay?.loading ?? true));
  // Set once deleted: the page is on its way out, not "missing".
  let leaving = $state(false);
  let notFound = $derived(!initialData && !isLoading && !leaving);

  function handleDelete(allowLeave: () => void) {
      if (!activeKimpay || !expenseId) return;
      // Leave the page first: it would show the expense as missing otherwise.
      confirmDeleteExpense(activeKimpay, expenseId, () => {
          leaving = true;
          allowLeave();
          return goBack(`/k/${kimpayId}`);
      });
  }
</script>

{#if initialData}
    <ExpenseForm {kimpayId} {initialData} title={$t('expense.edit.title')} onDelete={handleDelete} />
{:else}
    <div class="mx-auto w-full max-w-lg px-4 py-12">
        {#if isLoading}
            <div class="flex justify-center">
                <LoaderCircle class="h-8 w-8 animate-spin text-primary" />
            </div>
        {:else if notFound}
            <EmptyState title={$t('expense.not_found')} description={$t('expense.not_found_desc')}>
                {#snippet icon()}
                    <SearchX class="h-12 w-12" />
                {/snippet}
                {#snippet action()}
                    <Button href="/k/{kimpayId}" variant="soft">{$t('nav.expenses')}</Button>
                {/snippet}
            </EmptyState>
        {/if}
    </div>
{/if}
