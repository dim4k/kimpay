<script lang="ts">
  import { page } from '$app/state';
  import { getContext, onMount } from 'svelte';
  import { Wallet } from "lucide-svelte"; 
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import { t } from '$lib/i18n';
  import ExpenseItem from '$lib/components/expense/ExpenseItem.svelte';
  import { appState } from '$lib/stores/appState.svelte';
  import type { Expense } from '$lib/types';
  
  let kimpayId = $derived(page.params.id ?? '');
  
  // Use appState for reactive data
  let expenses = $derived(appState.expenses);
  let participants = $derived(appState.participants);
  let currentUserId = $derived(appState.participant?.id ?? null);
  
  let isLoading = $state(true);

  // Modal State
  let expenseToDelete = $state<string | null>(null);
  let isDeleting = $state(false);

  // Accordion State
  let expandedId = $state<string | null>(null);

  function toggleExpand(id: string) {
      if (expandedId === id) {
          expandedId = null;
      } else {
          expandedId = id;
      }
  }

  function openGallery(expense: Expense) {
      if (expense.photos && expense.photos.length > 0) {
          modals.gallery({
              photos: expense.photos,
              record: expense
          });
      }
  }

  onMount(async () => {
      if (kimpayId) {
          isLoading = true;
          await appState.init(kimpayId);
          isLoading = false;
      }
  });

  function requestDelete(id: string) {
      expenseToDelete = id;
  }

  async function confirmDelete() {
      if (!expenseToDelete) return;
      isDeleting = true;
      try {
          await appState.deleteExpense(expenseToDelete);
          // No need to reload manually, appState handles realtime updates
          expenseToDelete = null;
      } catch (e) {
          console.error("Failed to delete", e);
          alert("Failed to delete expense"); 
      } finally {
          isDeleting = false;
      }
  }

  const refreshSignal = getContext<{ count: number }>('refreshSignal');
  $effect(() => {
    // This will run when refreshSignal.count changes (triggered by layout)
    if (refreshSignal && refreshSignal.count > 0) {
        appState.refreshExpenses();
    }
  });
</script>

<main class="container p-4 space-y-6">
  <!-- Kimpay Title Section -->
  <header class="space-y-1">
      <div class="flex items-center gap-3">

        <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            {$t('nav.expenses')}
        </h1>
      </div>
      <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">
          <span class="font-semibold text-slate-700 dark:text-slate-300">{expenses.length}</span> {$t('expense.list.items')}
          <span class="mx-1">•</span>
          <span class="font-semibold text-slate-700 dark:text-slate-300">{participants.length || 0}</span> {$t('settings.participants').toLowerCase()}
      </p>
  </header>

  <div class="flex flex-col gap-4">
    <!-- Expenses List -->
    {#if isLoading}
        <div class="text-center py-8 text-slate-500 dark:text-slate-400">{$t('common.loading')}</div>
    {:else if expenses.length === 0}

        <div class="text-center py-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors animate-pop-in">
           <Wallet class="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
           <p class="text-slate-500 font-medium dark:text-slate-400">{$t('expense.list.empty.title')}</p>
           <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">{$t('expense.list.empty.desc')}</p>
        </div>
    {:else}
        <div class="space-y-3">
            {#each expenses as expense, i (expense.id)}
                <ExpenseItem 
                    {expense}
                    {currentUserId}
                    {expandedId}
                    {kimpayId}
                    onToggleExpand={() => toggleExpand(expense.id)}
                    onRequestDelete={() => requestDelete(expense.id)}
                    onOpenGallery={() => openGallery(expense)}
                    style="animation-delay: {i * 50}ms;"
                />
            {/each}
        </div>
    {/if}
  </div>

  <ConfirmModal 
      isOpen={!!expenseToDelete}
      title={$t('modal.delete_expense.title')}
      description={$t('modal.delete_expense.desc')}
      confirmText={$t('modal.delete_expense.confirm')}
      variant="destructive"
      isProcessing={isDeleting}
      onConfirm={confirmDelete}
      onCancel={() => expenseToDelete = null}
  />
</main>
