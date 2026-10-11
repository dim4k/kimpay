<script lang="ts">
  import { page } from '$app/state';
  import ExpenseForm from '$lib/components/ExpenseForm.svelte';
  import { confirmDeleteExpense } from '$lib/components/expense/deleteExpense';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { LoaderCircle, Trash2 } from "@lucide/svelte";
  import { t } from '$lib/i18n';
  import { getActiveKimpayContext } from '$lib/stores/activeKimpay.svelte';

  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpayId = $derived(activeKimpay?.id ?? '');
  let expenseId = $derived((page.params as Record<string, string>).expenseId);

  // Derived (not copied once): an expense missing from a stale cache shows up
  // as soon as fresh data arrives.
  let initialData = $derived(activeKimpay?.expenses.find(e => e.id === expenseId) ?? null);
  let isLoading = $derived(!initialData && (activeKimpay?.loading ?? true));
  let notFound = $derived(!initialData && !isLoading);

  function handleDelete() {
      if (!activeKimpay || !expenseId) return;
      // Leave the page first: it would show the expense as missing otherwise.
      confirmDeleteExpense(activeKimpay, expenseId, `/k/${kimpayId}`);
  }
</script>

<div class="container p-4 space-y-6 pb-24">
    <PageHeader title={$t('expense.edit.title')} subtitle={$t('expense.form.subtitle')} />

    <div class="bg-card rounded-2xl shadow-sm border p-6 space-y-6 transition-colors animate-pop-in">
        {#if isLoading}
            <div class="flex justify-center py-8">
                <LoaderCircle class="h-8 w-8 animate-spin text-primary" />
            </div>
        {:else if notFound}
            <div class="text-red-500 text-center">{$t('expense.not_found')}</div>
        {:else}
            <ExpenseForm {kimpayId} {initialData} />

            <div class="pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                    class="w-full py-3 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    onclick={handleDelete}
                >
                    <Trash2 class="h-4 w-4" />
                    {$t('modal.delete_expense.title')}
                </button>
            </div>
        {/if}
    </div>
</div>
