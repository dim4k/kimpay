<script lang="ts">
  import { getContext } from 'svelte';
  import { Wallet, AlertTriangle, Check, ArrowUpDown } from "lucide-svelte"; 
  import ConfirmModal from '$lib/components/ui/modals/ConfirmModal.svelte';
  import Dropdown from '$lib/components/ui/Dropdown.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ListSkeleton from '$lib/components/ui/ListSkeleton.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import { t } from '$lib/i18n';
  import ExpenseItem from '$lib/components/expense/ExpenseItem.svelte';
  import { getErrorMessage } from '$lib/utils/errors';
  import type { Expense } from '$lib/types';
  import type { TranslationKey } from '$lib/locales/en';
  import type { ActiveKimpay } from '$lib/stores/activeKimpay.svelte';
  import { offlineStore } from '$lib/stores/offline.svelte';
  import { DEFAULT_CURRENCY, convert, formatAmount } from '$lib/services/currency';
  import { toasts } from '$lib/stores/toasts.svelte';
  import { haptic } from '$lib/utils/haptic';
  
  // Get ActiveKimpay from context
  const ctx = getContext<{ value: ActiveKimpay }>('ACTIVE_KIMPAY');
  let activeKimpay = $derived(ctx.value);
  
  let kimpayId = $derived(activeKimpay?.id ?? '');
  let rawExpenses = $derived(activeKimpay?.expenses || []);
  let participants = $derived(activeKimpay?.participants || []);
  let currentUserId = $derived(activeKimpay?.myParticipantId ?? null);
  let isLoading = $derived(activeKimpay?.loading ?? true);
  let exchangeRates = $derived(activeKimpay?.exchangeRates || {});
  let kimpayC = $derived(activeKimpay?.kimpay?.currency || DEFAULT_CURRENCY);

  // Sort types and options
  type SortOption = 'created_desc' | 'created_asc' | 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  
  const sortOptions: { value: SortOption; labelKey: TranslationKey; icon?: string }[] = [
      { value: 'created_desc', labelKey: 'sort.created_desc' },
      { value: 'created_asc', labelKey: 'sort.created_asc' },
      { value: 'date_desc', labelKey: 'sort.date_desc' },
      { value: 'date_asc', labelKey: 'sort.date_asc' },
      { value: 'amount_desc', labelKey: 'sort.amount_desc' },
      { value: 'amount_asc', labelKey: 'sort.amount_asc' },
  ];

  // Sort state
  let sortOption = $state<SortOption>('created_desc');
  
  function getCurrentSortLabel(): string {
      const opt = sortOptions.find(o => o.value === sortOption);
      return opt ? $t(opt.labelKey) : sortOption;
  }

  // Convert amount to kimpay currency for comparison
  function toKimpayCurrency(amount: number, currency: string): number {
      return convert(amount, currency, kimpayC, exchangeRates);
  }

  // Sorted expenses
  let expenses = $derived.by(() => {
      const sorted = [...rawExpenses];
      
      switch (sortOption) {
          case 'created_desc':
              sorted.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
              break;
          case 'created_asc':
              sorted.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
              break;
          case 'date_desc':
              sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              break;
          case 'date_asc':
              sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              break;
          case 'amount_desc':
              sorted.sort((a, b) => toKimpayCurrency(b.amount, b.currency) - toKimpayCurrency(a.amount, a.currency));
              break;
          case 'amount_asc':
              sorted.sort((a, b) => toKimpayCurrency(a.amount, a.currency) - toKimpayCurrency(b.amount, b.currency));
              break;
      }
      
      return sorted;
  });

  // Calculate my contribution (total I paid)
  let myContribution = $derived.by(() => {
      if (!currentUserId) return 0;
      return rawExpenses
          .filter(e => e.payer === currentUserId && !e.is_reimbursement)
          .reduce((sum, e) => sum + toKimpayCurrency(e.amount, e.currency), 0);
  });

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

  function requestDelete(id: string) {
      expenseToDelete = id;
  }

  async function confirmDelete() {
      if (!expenseToDelete || !activeKimpay) return;
      isDeleting = true;
      try {
          await activeKimpay.deleteExpense(expenseToDelete);
          expenseToDelete = null;
          haptic('success');
          toasts.success($t('toast.expense_deleted'));
      } catch (e) {
          console.error("Failed to delete", e);
          haptic('error');
          toasts.error(getErrorMessage(e, $t));
      } finally {
          isDeleting = false;
      }
  }
</script>

<div class="container p-4 space-y-6">
  <!-- Kimpay Title Section -->
  <header class="space-y-1">
      <h1 class="text-2xl font-extrabold text-gradient-brand w-fit">
          {$t('nav.expenses')}
      </h1>
      <p class="text-muted-foreground font-medium text-sm">
          <span class="font-semibold text-foreground/80">{expenses.length}</span> {$t('expense.list.items')}
          <span class="mx-1">•</span>
          <span class="font-semibold text-foreground/80">{participants.length || 0}</span> {$t('settings.participants').toLowerCase()}
      </p>
  </header>

  {#if offlineStore.isOffline}
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3 animate-in fade-in">
          <AlertTriangle class="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p class="text-sm text-amber-700 dark:text-amber-300">{$t('expense.offline_warning')}</p>
      </div>
  {/if}

  <div class="flex flex-col gap-4">
    <!-- Sort Selector - above expense list -->
    {#if expenses.length > 0}
        <div class="flex items-center justify-between">
            <!-- My Contribution -->
            {#if currentUserId}
                <span class="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">
                    {$t('expense.my_contribution')}: {formatAmount(myContribution, kimpayC)}
                </span>
            {:else}
                <div></div>
            {/if}
            <Dropdown size="sm">
                {#snippet trigger()}
                    <ArrowUpDown class="h-3 w-3 text-muted-foreground" />
                    <span class="text-xs">{getCurrentSortLabel()}</span>
                {/snippet}
                {#snippet items(close)}
                    {#each sortOptions as opt (opt.value)}
                        <button
                            type="button"
                            onclick={() => { sortOption = opt.value; close(); }}
                            class="w-full flex items-center justify-between px-3 py-2 hover:bg-muted transition-colors text-sm {sortOption === opt.value ? 'bg-secondary' : ''}"
                        >
                            <span class="font-medium text-xs">{$t(opt.labelKey as import('$lib/locales/en').TranslationKey)}</span>
                            {#if sortOption === opt.value}
                                <Check class="h-3.5 w-3.5 text-primary" />
                            {/if}
                        </button>
                    {/each}
                {/snippet}
            </Dropdown>
        </div>
    {/if}

    <!-- Expenses List -->
    {#if isLoading}
        <ListSkeleton />
    {:else if expenses.length === 0}
        <EmptyState
            title={$t('expense.list.empty.title')}
            description={$t('expense.list.empty.desc')}
            class="animate-pop-in"
        >
            {#snippet icon()}
                <Wallet class="h-12 w-12" />
            {/snippet}
        </EmptyState>
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
</div>
