<script lang="ts">
  import { getContext } from 'svelte';
  import { Wallet, AlertTriangle, ChevronDown, Check, ArrowUpDown } from "lucide-svelte"; 
  import { slide } from 'svelte/transition';
  import ConfirmModal from '$lib/components/ui/modals/ConfirmModal.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import { t } from '$lib/i18n';
  import ExpenseItem from '$lib/components/expense/ExpenseItem.svelte';
  import { getErrorMessage } from '$lib/utils/errors';
  import type { Expense } from '$lib/types';
  import type { ActiveKimpay } from '$lib/stores/activeKimpay.svelte';
  import { offlineService } from '$lib/services/offline.svelte';
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
  
  const sortOptions: { value: SortOption; labelKey: string; icon?: string }[] = [
      { value: 'created_desc', labelKey: 'sort.created_desc' },
      { value: 'created_asc', labelKey: 'sort.created_asc' },
      { value: 'date_desc', labelKey: 'sort.date_desc' },
      { value: 'date_asc', labelKey: 'sort.date_asc' },
      { value: 'amount_desc', labelKey: 'sort.amount_desc' },
      { value: 'amount_asc', labelKey: 'sort.amount_asc' },
  ];

  // Sort state
  let sortOption = $state<SortOption>('created_desc');
  let isSortOpen = $state(false);
  
  function getCurrentSortLabel(): string {
      return $t(sortOptions.find(o => o.value === sortOption)?.labelKey as import('$lib/locales/en').TranslationKey) || sortOption;
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
          toasts.success($t('modal.delete_expense.confirm'));
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

  {#if offlineService.isOffline}
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
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1">
                    {$t('expense.my_contribution')}: {formatAmount(myContribution, kimpayC)}
                </span>
            {:else}
                <div></div>
            {/if}
            <div class="relative">
                <button
                    type="button"
                    onclick={() => isSortOpen = !isSortOpen}
                    class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                    <ArrowUpDown class="h-3 w-3 text-slate-400" />
                    <span class="text-slate-700 dark:text-slate-200 text-xs">{getCurrentSortLabel()}</span>
                    <ChevronDown class="h-3 w-3 text-slate-400 transition-transform {isSortOpen ? 'rotate-180' : ''}" />
                </button>

                {#if isSortOpen}
                    <div class="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 min-w-[140px] max-h-48 overflow-y-auto" transition:slide={{ duration: 150 }}>
                        {#each sortOptions as opt (opt.value)}
                            <button
                                type="button"
                                onclick={() => { sortOption = opt.value; isSortOpen = false; }}
                                class="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm {sortOption === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}"
                            >
                                <span class="font-medium text-slate-700 dark:text-slate-200 text-xs">{$t(opt.labelKey as import('$lib/locales/en').TranslationKey)}</span>
                                {#if sortOption === opt.value}
                                    <Check class="h-3.5 w-3.5 text-indigo-500" />
                                {/if}
                            </button>
                        {/each}
                    </div>
                    <div 
                        class="fixed inset-0 z-40" 
                        onclick={() => isSortOpen = false} 
                        role="button" 
                        tabindex="-1" 
                        onkeydown={(e) => e.key === 'Escape' && (isSortOpen = false)}
                    ></div>
                {/if}
            </div>
        </div>
    {/if}

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
</div>
