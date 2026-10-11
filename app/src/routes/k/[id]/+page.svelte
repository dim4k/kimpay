<script lang="ts">
  import { Wallet, Check, ArrowUpDown, Search, SlidersHorizontal, X } from "@lucide/svelte";
  import { confirmDeleteExpense } from '#lib/components/expense/deleteExpense.js';
  import Dropdown from '#lib/components/ui/Dropdown.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { t, locale } from '#lib/i18n.js';
  import ExpenseItem from '#lib/components/expense/ExpenseItem.svelte';
  import type { Expense } from '#lib/types.js';
  import type { TranslationKey } from '#lib/locales/en.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import OfflineBanner from '#lib/components/ui/OfflineBanner.svelte';
  import { DEFAULT_CURRENCY, formatAmount } from '#lib/services/currency.js';
  import { toKimpayAmount } from '#lib/balance.js';
  import { EMOJI_CATEGORIES, EMOJI_CATEGORY_ORDER, STORAGE_KEYS, emojiCategory, type EmojiCategoryKey } from '#lib/constants.js';

  // Get ActiveKimpay from context
  const ctx = getActiveKimpayContext();
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

  // Sort state, remembered on this device
  function loadSort(): SortOption {
      try {
          const saved = localStorage.getItem(STORAGE_KEYS.EXPENSE_SORT);
          const option = sortOptions.find(o => o.value === saved);
          if (option) return option.value;
      } catch {
          // Storage unavailable (private mode...): default order.
      }
      return 'created_desc';
  }

  let sortOption = $state<SortOption>(loadSort());

  function setSort(value: SortOption) {
      sortOption = value;
      try {
          localStorage.setItem(STORAGE_KEYS.EXPENSE_SORT, value);
      } catch {
          // Not remembered, still applied.
      }
  }

  function getCurrentSortLabel(): string {
      const opt = sortOptions.find(o => o.value === sortOption);
      return opt ? $t(opt.labelKey) : sortOption;
  }

  // Search & filters
  type TypeFilter = 'all' | 'expense' | 'income' | 'reimbursement';
  const typeOptions: { value: TypeFilter; labelKey: TranslationKey }[] = [
      { value: 'all', labelKey: 'filter.type.all' },
      { value: 'expense', labelKey: 'filter.type.expense' },
      { value: 'income', labelKey: 'filter.type.income' },
      { value: 'reimbursement', labelKey: 'filter.type.reimbursement' },
  ];

  let search = $state('');
  let showFilters = $state(false);
  let personFilter = $state<string | null>(null);
  let typeFilter = $state<TypeFilter>('all');
  let categoryFilter = $state<EmojiCategoryKey | null>(null);

  let activeFilterCount = $derived((personFilter ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0) + (categoryFilter ? 1 : 0));
  let isFiltering = $derived(activeFilterCount > 0 || search.trim() !== '');

  // Only the categories present in this Kimpay are worth offering.
  let categories = $derived.by(() => {
      const present = new Set(rawExpenses.filter(e => !e.is_reimbursement).map(e => emojiCategory(e.icon)));
      return EMOJI_CATEGORY_ORDER.filter(k => present.has(k));
  });

  /** Lowercase, without accents, for a forgiving search. */
  function normalize(text: string): string {
      return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function clearFilters() {
      search = '';
      personFilter = null;
      typeFilter = 'all';
      categoryFilter = null;
  }

  let filteredExpenses = $derived.by(() => {
      const query = normalize(search.trim());
      return rawExpenses.filter(e => {
          if (typeFilter === 'reimbursement' && !e.is_reimbursement) return false;
          if (typeFilter === 'income' && !e.is_income) return false;
          if (typeFilter === 'expense' && (e.is_reimbursement || e.is_income)) return false;
          if (personFilter && e.payer !== personFilter && !e.involved?.includes(personFilter)) return false;
          if (categoryFilter && (e.is_reimbursement || emojiCategory(e.icon) !== categoryFilter)) return false;
          if (query) {
              const text = [
                  e.is_reimbursement ? $t('balance.reimbursement') : e.description,
                  e.expand?.payer?.name ?? '',
                  ...(e.expand?.involved?.map(p => p.name) ?? []),
              ].join(' ');
              if (!normalize(text).includes(query)) return false;
          }
          return true;
      });
  });

  // Convert an expense to the kimpay currency for comparison
  function toKimpayCurrency(expense: Expense): number {
      return toKimpayAmount(expense, kimpayC, exchangeRates);
  }

  // Net total of the filtered list (money received counts negatively).
  let filteredTotal = $derived(
      filteredExpenses.reduce((sum, e) => sum + (e.is_income ? -1 : 1) * toKimpayCurrency(e), 0)
  );

  // Sorted expenses
  let expenses = $derived.by(() => {
      const sorted = [...filteredExpenses];

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
              sorted.sort((a, b) => toKimpayCurrency(b) - toKimpayCurrency(a));
              break;
          case 'amount_asc':
              sorted.sort((a, b) => toKimpayCurrency(a) - toKimpayCurrency(b));
              break;
      }

      return sorted;
  });

  // Calculate my contribution (total I paid)
  let myContribution = $derived.by(() => {
      if (!currentUserId) return 0;
      return rawExpenses
          .filter(e => e.payer === currentUserId && !e.is_reimbursement && !e.is_income)
          .reduce((sum, e) => sum + toKimpayCurrency(e), 0);
  });

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
      if (activeKimpay) confirmDeleteExpense(activeKimpay, id);
  }
</script>

{#snippet filterOption(label: string, selected: boolean, onclick: () => void)}
    <button
        type="button"
        {onclick}
        class="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted transition-colors text-left {selected ? 'bg-secondary' : ''}"
    >
        <span class="font-medium text-xs whitespace-nowrap">{label}</span>
        {#if selected}
            <Check class="h-3.5 w-3.5 text-primary" />
        {/if}
    </button>
{/snippet}

<div class="container p-4 space-y-6">
  <!-- Kimpay Title Section -->
  <header class="space-y-1">
      <h1 class="text-2xl font-extrabold text-gradient-brand w-fit">
          {$t('nav.expenses')}
      </h1>
      <p class="text-muted-foreground font-medium text-sm">
          <span class="font-semibold text-foreground/80">{rawExpenses.length}</span> {$t('expense.list.items')}
          <span class="mx-1">•</span>
          <span class="font-semibold text-foreground/80">{participants.length || 0}</span> {$t('settings.participants').toLowerCase()}
      </p>
  </header>

  <OfflineBanner message={$t('expense.offline_warning')} />

  <div class="flex flex-col gap-4">
    <!-- Search & filters -->
    {#if rawExpenses.length > 0}
        <div class="space-y-2">
            <div class="flex gap-2">
                <div class="relative flex-1">
                    <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        bind:value={search}
                        placeholder={$t('filter.search_placeholder')}
                        aria-label={$t('filter.search_placeholder')}
                        class="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700"
                    />
                </div>
                <button
                    type="button"
                    onclick={() => showFilters = !showFilters}
                    aria-expanded={showFilters}
                    aria-label={$t('filter.toggle')}
                    class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-card transition-colors hover:bg-muted dark:border-slate-700 {showFilters ? 'text-primary border-primary/40' : 'text-muted-foreground'}"
                >
                    <SlidersHorizontal class="h-4 w-4" />
                    {#if activeFilterCount > 0}
                        <span class="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{activeFilterCount}</span>
                    {/if}
                </button>
            </div>

            {#if showFilters}
                <div class="flex flex-wrap gap-2">
                    <Dropdown size="sm" position="bottom-left" label={$t('filter.person')}>
                        {#snippet trigger()}
                            <span class="text-xs {personFilter ? 'text-primary' : ''}">
                                {personFilter ? (activeKimpay?.participantsById.get(personFilter)?.name ?? $t('common.unknown')) : $t('filter.person.all')}
                            </span>
                        {/snippet}
                        {#snippet items(close)}
                            {@render filterOption($t('filter.person.all'), personFilter === null, () => { personFilter = null; close(); })}
                            {#each participants as p (p.id)}
                                {@render filterOption(p.name, personFilter === p.id, () => { personFilter = p.id; close(); })}
                            {/each}
                        {/snippet}
                    </Dropdown>

                    <Dropdown size="sm" position="bottom-left" label={$t('filter.type')}>
                        {#snippet trigger()}
                            <span class="text-xs {typeFilter !== 'all' ? 'text-primary' : ''}">
                                {$t(typeOptions.find(o => o.value === typeFilter)?.labelKey ?? 'filter.type.all')}
                            </span>
                        {/snippet}
                        {#snippet items(close)}
                            {#each typeOptions as opt (opt.value)}
                                {@render filterOption($t(opt.labelKey), typeFilter === opt.value, () => { typeFilter = opt.value; close(); })}
                            {/each}
                        {/snippet}
                    </Dropdown>

                    {#if categories.length > 1 || categoryFilter}
                        <Dropdown size="sm" position="bottom-left" label={$t('filter.category')}>
                            {#snippet trigger()}
                                <span class="text-xs {categoryFilter ? 'text-primary' : ''}">
                                    {categoryFilter ? $t(EMOJI_CATEGORIES[categoryFilter]!.labelKey) : $t('filter.category.all')}
                                </span>
                            {/snippet}
                            {#snippet items(close)}
                                {@render filterOption($t('filter.category.all'), categoryFilter === null, () => { categoryFilter = null; close(); })}
                                {#each categories as key (key)}
                                    {@render filterOption(`${EMOJI_CATEGORIES[key]!.emojis[0]} ${$t(EMOJI_CATEGORIES[key]!.labelKey)}`, categoryFilter === key, () => { categoryFilter = key; close(); })}
                                {/each}
                            {/snippet}
                        </Dropdown>
                    {/if}
                </div>
            {/if}

            {#if isFiltering}
                <div class="flex items-center justify-between pl-1 text-xs text-muted-foreground">
                    <span>
                        {$t('filter.results', { count: String(filteredExpenses.length) })}
                        <span class="mx-1">•</span>
                        <span class="font-semibold text-foreground/80">{formatAmount(filteredTotal, kimpayC, $locale)}</span>
                    </span>
                    <button type="button" onclick={clearFilters} class="flex items-center gap-1 font-medium text-primary hover:underline">
                        <X class="h-3 w-3" />
                        {$t('filter.clear')}
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Sort Selector - above expense list -->
    {#if expenses.length > 0}
        <div class="flex items-center justify-between">
            <!-- My Contribution -->
            {#if currentUserId}
                <span class="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">
                    {$t('expense.my_contribution')}: {formatAmount(myContribution, kimpayC, $locale)}
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
                            onclick={() => { setSort(opt.value); close(); }}
                            class="w-full flex items-center justify-between px-3 py-2 hover:bg-muted transition-colors text-sm {sortOption === opt.value ? 'bg-secondary' : ''}"
                        >
                            <span class="font-medium text-xs">{$t(opt.labelKey as import('#lib/locales/en.js').TranslationKey)}</span>
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
    {:else if rawExpenses.length > 0 && expenses.length === 0}
        <EmptyState
            title={$t('filter.empty.title')}
            description={$t('filter.empty.desc')}
            class="animate-pop-in"
        >
            {#snippet icon()}
                <Search class="h-12 w-12" />
            {/snippet}
        </EmptyState>
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
        <div class="flex flex-col gap-4">
            {#each expenses as expense, i (expense.id)}
                <ExpenseItem
                    {expense}
                    {currentUserId}
                    {expandedId}
                    {kimpayId}
                    onToggleExpand={toggleExpand}
                    onRequestDelete={requestDelete}
                    onOpenGallery={openGallery}
                    style="animation-delay: {i * 50}ms;"
                />
            {/each}
        </div>
    {/if}
  </div>
</div>
