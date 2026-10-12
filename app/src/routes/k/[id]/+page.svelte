<script lang="ts">
  import { Wallet, Check, ChevronRight, Search, SlidersHorizontal, X } from "@lucide/svelte";
  import { confirmDeleteExpense } from '#lib/components/expense/deleteExpense.js';
  import Dropdown from '#lib/components/ui/Dropdown.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { t, locale } from '#lib/i18n.js';
  import ExpenseItem from '#lib/components/expense/ExpenseItem.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import { Input } from '#lib/components/ui/input/index.js';
  import { parseLocalISODate, toLocalISODate } from '#lib/utils/date.js';
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

  const sortOptions: { value: SortOption; labelKey: TranslationKey }[] = [
      { value: 'date_desc', labelKey: 'sort.date_desc' },
      { value: 'date_asc', labelKey: 'sort.date_asc' },
      { value: 'created_desc', labelKey: 'sort.created_desc' },
      { value: 'created_asc', labelKey: 'sort.created_asc' },
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
      return 'date_desc';
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
          // Same day: the last one added first.
          case 'date_desc':
              sorted.sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10)) || b.created.localeCompare(a.created));
              break;
          case 'date_asc':
              sorted.sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || a.created.localeCompare(b.created));
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

  let participantIds = $derived(participants.map(p => p.id));
  let myBalance = $derived(activeKimpay?.myBalance ?? 0);
  let owesMoney = $derived(myBalance < -0.005);
  let isOwed = $derived(myBalance > 0.005);

  /** "Today", "Yesterday", then the full date. */
  function dayLabel(key: string): string {
      const today = new Date();
      if (key === toLocalISODate(today)) return $t('datepicker.today');
      if (key === toLocalISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))) return $t('date.yesterday');
      return parseLocalISODate(key).toLocaleDateString($locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          ...(key.slice(0, 4) !== String(today.getFullYear()) && { year: 'numeric' }),
      });
  }

  // Sorted by date: one list per day. Other sorts: a single list.
  let sections = $derived.by(() => {
      if (sortOption !== 'date_desc' && sortOption !== 'date_asc') {
          return [{ key: 'all', label: '', items: expenses }];
      }
      const days: { key: string; label: string; items: Expense[] }[] = [];
      for (const expense of expenses) {
          const key = expense.date.slice(0, 10);
          const last = days[days.length - 1];
          if (last?.key === key) last.items.push(expense);
          else days.push({ key, label: dayLabel(key), items: [expense] });
      }
      return days;
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
        class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted {selected ? 'bg-primary-soft' : ''}"
    >
        <span class="whitespace-nowrap text-sm font-medium">{label}</span>
        {#if selected}
            <Check class="h-4 w-4 text-primary" />
        {/if}
    </button>
{/snippet}

<div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-4">
  <h1 class="sr-only">{$t('nav.expenses')}</h1>

  <OfflineBanner message={$t('expense.offline_warning')} />

  {#if !isLoading && rawExpenses.length > 0 && currentUserId}
      <!-- My balance in one line; the details are in the Balance tab. -->
      <a
          href="/k/{kimpayId}/balance"
          data-sveltekit-replacestate
          class="flex min-h-11 items-center gap-2 rounded-control border bg-card px-4 py-2 transition-colors duration-150 hover:bg-muted/50 animate-pop-in"
      >
          {#if owesMoney || isOwed}
              <span class="text-sm text-muted-foreground">{owesMoney ? $t('balance.you_owe') : $t('balance.owed_to_you')}</span>
              <span class="font-bold tabular-nums {owesMoney ? 'text-warning' : 'text-success'}">{formatAmount(Math.abs(myBalance), kimpayC, $locale)}</span>
          {:else}
              <Check class="h-4 w-4 shrink-0 text-success" />
              <span class="text-sm font-medium">{$t('balance.settled.title')}</span>
          {/if}
          <span class="ml-auto flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
              {owesMoney ? $t('expense.hero.settle') : $t('nav.balance')}
              <ChevronRight class="h-4 w-4" />
          </span>
      </a>
  {/if}

  {#if rawExpenses.length > 0}
      <div class="space-y-2">
          <div class="flex gap-2">
              <div class="relative flex-1">
                  <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                      type="search"
                      bind:value={search}
                      placeholder={$t('filter.search_placeholder')}
                      aria-label={$t('filter.search_placeholder')}
                      class="pl-9"
                  />
              </div>
              <button
                  type="button"
                  onclick={() => showFilters = !showFilters}
                  aria-expanded={showFilters}
                  aria-label={$t('filter.toggle')}
                  class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-control border bg-card transition-colors hover:bg-muted {showFilters || activeFilterCount > 0 ? 'border-primary/50 text-primary' : 'border-input text-muted-foreground'}"
              >
                  <SlidersHorizontal class="h-4 w-4" />
                  {#if activeFilterCount > 0}
                      <span class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">{activeFilterCount}</span>
                  {/if}
              </button>
          </div>

          {#if showFilters}
              <div class="flex flex-wrap gap-2">
                  <Dropdown position="bottom-left" label={$t('filter.person')}>
                      {#snippet trigger()}
                          <span class={personFilter ? 'text-primary' : ''}>
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

                  <Dropdown position="bottom-left" label={$t('filter.type')}>
                      {#snippet trigger()}
                          <span class={typeFilter !== 'all' ? 'text-primary' : ''}>
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
                      <Dropdown position="bottom-left" label={$t('filter.category')}>
                          {#snippet trigger()}
                              <span class={categoryFilter ? 'text-primary' : ''}>
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

                  <Dropdown position="bottom-left" label={$t('sort.label')}>
                      {#snippet trigger()}
                          <span>{getCurrentSortLabel()}</span>
                      {/snippet}
                      {#snippet items(close)}
                          {#each sortOptions as opt (opt.value)}
                              {@render filterOption($t(opt.labelKey), sortOption === opt.value, () => { setSort(opt.value); close(); })}
                          {/each}
                      {/snippet}
                  </Dropdown>
              </div>
          {/if}

          {#if isFiltering}
              <div class="flex items-center justify-between px-1 text-sm text-muted-foreground">
                  <span>
                      {$t('filter.results', { count: String(filteredExpenses.length) })}
                      <span aria-hidden="true">·</span>
                      <span class="font-semibold text-foreground">{formatAmount(filteredTotal, kimpayC, $locale)}</span>
                  </span>
                  <button type="button" onclick={clearFilters} class="flex min-h-9 items-center gap-1 font-semibold text-primary hover:underline">
                      <X class="h-3.5 w-3.5" />
                      {$t('filter.clear')}
                  </button>
              </div>
          {/if}
      </div>
  {/if}

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
      {#each sections as section (section.key)}
          <section class="space-y-2 animate-slide-up">
              {#if section.label}
                  <SectionLabel title={section.label} />
              {/if}
              <ListGroup>
                  {#each section.items as expense (expense.id)}
                      <ExpenseItem
                          {expense}
                          {currentUserId}
                          {participantIds}
                          {expandedId}
                          {kimpayId}
                          onToggleExpand={toggleExpand}
                          onRequestDelete={requestDelete}
                          onOpenGallery={openGallery}
                      />
                  {/each}
              </ListGroup>
          </section>
      {/each}
  {/if}
</div>
