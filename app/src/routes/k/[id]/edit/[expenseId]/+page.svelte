<script lang="ts">
  import { page } from '$app/state';
  import { getContext } from 'svelte';
  import ExpenseForm from '$lib/components/ExpenseForm.svelte';
  import { goto } from '$app/navigation';
  import ConfirmModal from '$lib/components/ui/modals/ConfirmModal.svelte';
  import { LoaderCircle, Trash2 } from "lucide-svelte";
  import { t } from '$lib/i18n';
  import type { ActiveKimpay } from '$lib/stores/activeKimpay.svelte';

  const ctx = getContext<{ value: ActiveKimpay }>('ACTIVE_KIMPAY');
  let activeKimpay = $derived(ctx.value);
  
  let kimpayId = $derived(activeKimpay?.id ?? '');
  let expenseId = $derived((page.params as Record<string, string>).expenseId);
  
  let initialData = $state<unknown>(null);
  let isLoading = $state(true);
  let error = $state("");
  let showDeleteConfirm = $state(false);
  let isDeleting = $state(false);

  $effect(() => {
      if (activeKimpay && expenseId) {
          if (activeKimpay.loading) {
              isLoading = true;
          } else {
              const found = activeKimpay.expenses.find(e => e.id === expenseId);
              if (found) {
                  initialData = found;
                  isLoading = false;
              } else {
                  error = "Expense not found";
                  isLoading = false;
              }
          }
      }
  });

  async function handleDelete() {
      if (!activeKimpay || !expenseId) return;
      isDeleting = true;
      try {
          await activeKimpay.deleteExpense(expenseId);
          goto(`/k/${kimpayId}`);
      } catch (e) {
          console.error(e);
      } finally {
          isDeleting = false;
      }
  }
</script>

<div class="container p-4 space-y-6 pb-24">
    <header class="space-y-1">
        <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 w-fit">{$t('expense.edit.title')}</h1>
        <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">{$t('expense.form.subtitle')}</p>
    </header>

    <div class="bg-card rounded-2xl shadow-sm border p-6 space-y-6 transition-colors animate-pop-in">
        {#if isLoading}
            <div class="flex justify-center py-8">
                <LoaderCircle class="h-8 w-8 animate-spin text-primary" />
            </div>
        {:else if error}
            <div class="text-red-500 text-center">{error}</div>
        {:else}
            <ExpenseForm {kimpayId} {initialData} />
            
            <div class="pt-6 border-t border-slate-100 dark:border-slate-800">
                <button 
                    class="w-full py-3 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    onclick={() => showDeleteConfirm = true}
                >
                    <Trash2 class="h-4 w-4" />
                    {$t('modal.delete_expense.title')}
                </button>
            </div>
        {/if}
    </div>

    <ConfirmModal 
        isOpen={showDeleteConfirm}
        title={$t('modal.delete_expense.title')}
        description={$t('modal.delete_expense.desc')}
        confirmText={$t('modal.delete_expense.confirm')}
        variant="destructive"
        isProcessing={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => showDeleteConfirm = false}
    />
</div>
