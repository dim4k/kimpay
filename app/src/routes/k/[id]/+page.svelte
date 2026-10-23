<script lang="ts">
  import { Wallet, Check, Plus, Search, SlidersHorizontal, UserPlus, X } from "@lucide/svelte";
  import InviteSheet from '#lib/components/members/InviteSheet.svelte';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import { NAME_MAX_LENGTH } from '#lib/constants.js';
  import { hasJoined } from '#lib/utils/members.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import ReceiptScanner from '#lib/components/ReceiptScanner.svelte';
  import { pendingReceipt } from '#lib/stores/pendingReceipt.js';
  import { confirmDiscard, expenseSheet, openExpenseSheet, opensExpenseSheet, showExpenseSheet } from '#lib/expenseSheet.js';
  import { layout } from '#lib/stores/layout.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { confirmDeleteExpense } from '#lib/components/expense/deleteExpense.js';
  import Dropdown from '#lib/components/ui/Dropdown.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { t, locale } from '#lib/i18n.js';
  import ExpenseItem from '#lib/components/expense/ExpenseItem.svelte';
  import ExpenseDetailsSheet from '#lib/components/expense/ExpenseDetailsSheet.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import { Input } from '#lib/components/ui/input/index.js';
  import { dayLabel, groupByDay } from '#lib/utils/date.js';
  import type { Expense } from '#lib/types.js';
  import type { TranslationKey } from '#lib/locales/en.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import OfflineBanner from '#lib/components/ui/OfflineBanner.svelte';
  import { DEFAULT_CURRENCY, formatAmount } from '#lib/services/currency.js';
  import { balanceSign, balanceTone, expenseImpact, isSettled, toKimpayAmount } from '#lib/balance.js';
  import { expenseView } from '#lib/stores/expenseView.svelte.js';
  import { prefs } from '#lib/utils/prefs.js';
  import { activitySeenAt, changesSince, listActivity, markActivitySeen, type Activity } from '#lib/services/activity.js';
  import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
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

  // Sort: by date, by date added or by amount, the latest / biggest first;
  // a second tap on the same choice reverses it. Remembered on this device.
  type SortKey = 'date' | 'created' | 'amount';
  type SortOption = `${SortKey}_${'desc' | 'asc'}`;

  const sortKeys: { key: SortKey; labelKey: TranslationKey }[] = [
      { key: 'date', labelKey: 'sort.date' },
      { key: 'created', labelKey: 'sort.created' },
      { key: 'amount', labelKey: 'sort.amount' },
  ];

  function loadSort(): SortOption {
      const saved = prefs.get(STORAGE_KEYS.EXPENSE_SORT) ?? '';
      return /^(date|created|amount)_(desc|asc)$/.test(saved) ? (saved as SortOption) : 'date_desc';
  }

  let sortOption = $state<SortOption>(loadSort());
  let sortKey = $derived(sortOption.split('_')[0] as SortKey);
  let sortReversed = $derived(sortOption.endsWith('_asc'));

  function chooseSort(key: SortKey) {
      sortOption = key === sortKey && !sortReversed ? `${key}_asc` : `${key}_desc`;
      prefs.set(STORAGE_KEYS.EXPENSE_SORT, sortOption);
  }

  /** "Date ↓": the choice, and which way. */
  function sortLabel(key: SortKey): string {
      const label = $t(sortKeys.find(s => s.key === key)!.labelKey);
      return key === sortKey ? `${label} ${sortReversed ? '↑' : '↓'}` : label;
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
  // Computers: the filters always in view (no button to show them).
  let filtersShown = $derived(showFilters || layout.wide);
  // A member opened from the Members tab ("?person=ID"), applied once.
  const linkedPerson = page.url.searchParams.get('person');
  let personFilter = $state<string | null>(linkedPerson);
  let typeFilter = $state<TypeFilter>('all');
  // A category opened from the balance page ("?category=FOOD"), applied once.
  const linkedCategory = page.url.searchParams.get('category');
  let categoryFilter = $state<EmojiCategoryKey | null>(
      EMOJI_CATEGORY_ORDER.find((key) => key === linkedCategory) ?? null
  );
  onMount(() => {
      if (!linkedCategory && !linkedPerson) return;
      const url = new URL(page.url.href);
      url.searchParams.delete('category');
      url.searchParams.delete('person');
      replaceState(url, page.state);
      // The chip says whose expenses these are.
      if (linkedPerson) showFilters = true;
  });

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

  /** Filters are chips: outlined, tinted once set. */
  function chipClass(active: boolean): string {
      return `h-9 rounded-full border px-3.5 ${active ? 'border-primary/50 bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70' : 'border-input bg-card hover:bg-muted'}`;
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
                  e.notes ?? '',
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

  /** "Today", "Yesterday", then the date ("Sat 19 Sep" when `short`). */
  function dayTitle(key: string, short = false): string {
      return dayLabel(key, $locale, { today: $t('datepicker.today'), yesterday: $t('date.yesterday') }, short);
  }

  /**
   * What the group spent (reimbursements are not spending), and what it
   * changed to my balance, in the Kimpay currency.
   */
  function amounts(items: Expense[]): { total: number; mine: number; reimbursements: number } {
      let total = 0;
      let mine = 0;
      // Only reimbursements: their count says more than a 0 total.
      const reimbursements = items.every(e => e.is_reimbursement) ? items.length : 0;
      for (const e of items) {
          const value = toKimpayCurrency(e);
          if (!e.is_reimbursement) total += (e.is_income ? -1 : 1) * value;
          const impact = currentUserId ? expenseImpact(e, currentUserId, participantIds) : null;
          if (typeof impact === 'number' && e.amount > 0) mine += impact * (value / e.amount);
      }
      return { total, mine, reimbursements };
  }

  // Sorted by date: one list per day. Other sorts: a single list.
  let sections = $derived.by(() => {
      if (sortOption !== 'date_desc' && sortOption !== 'date_asc') {
          const shortLabel = $t('expense.list.count', { count: String(expenses.length) });
          return [{ key: 'all', label: '', shortLabel, items: expenses, ...amounts(expenses) }];
      }
      return groupByDay(expenses).map((day) => ({
          ...day,
          label: dayTitle(day.key),
          shortLabel: dayTitle(day.key, true),
          ...amounts(day.items),
      }));
  });

  // Total or "for me": what the amounts of the list say (shared with the
  // balance page). "For me" needs an identity in the group.
  let canChooseView = $derived(!!currentUserId);
  let view = $derived(canChooseView ? expenseView.choice : 'total');

  // The search bar sticks under the header. Once the list scrolls under it,
  // it shrinks to one line: the day in view and its amount, the search
  // button and the view switch.
  let sentinel = $state<HTMLElement>();
  let bar = $state<HTMLElement>();
  let searchInput = $state<HTMLInputElement | null>(null);
  let isCompact = $state(false);
  let currentKey = $state<string | null>(null);
  let focusSearch = false;
  let current = $derived(sections.find((section) => section.key === currentKey) ?? sections[0]);

  $effect(() => {
      const top = sentinel;
      const stuck = bar;
      const scroller = top?.closest('main');
      if (!top || !stuck || !scroller) return;
      let frame = 0;
      const update = () => {
          frame = 0;
          const barBox = stuck.getBoundingClientRect();
          // The line right above the bar went up while the bar stayed: stuck.
          // Computers have the height for the full bar.
          isCompact = !layout.wide && top.getBoundingClientRect().top < barBox.top - 1;
          if (!isCompact) return;
          let key: string | null = null;
          for (const section of scroller.querySelectorAll<HTMLElement>('[data-section]')) {
              if (section.getBoundingClientRect().top > barBox.bottom + 1) break;
              key = section.dataset.section ?? null;
          }
          currentKey = key;
      };
      const onScroll = () => {
          if (!frame) frame = requestAnimationFrame(update);
      };
      scroller.addEventListener('scroll', onScroll, { passive: true });
      update();
      return () => {
          scroller.removeEventListener('scroll', onScroll);
          cancelAnimationFrame(frame);
      };
  });

  /** Back to the full bar, at the top of the list, with the search field focused. */
  function openSearch() {
      focusSearch = true;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      sentinel?.closest('main')?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  $effect(() => {
      if (!isCompact && searchInput && focusSearch) {
          focusSearch = false;
          searchInput.focus({ preventScroll: true });
      }
  });

  // Added by others since my last visit on this device (see seenIds).
  let newIds = $derived.by(() => {
      const seen = activeKimpay?.seenIds;
      return new Set(seen ? rawExpenses.filter(e => !seen.has(e.id)).map(e => e.id) : []);
  });

  /** To the first new line in the list. */
  function showNews() {
      const first = expenses.find(e => newIds.has(e.id));
      if (!first) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.querySelector(`[data-expense="${first.id}"]`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }

  // A line touched opens its sheet: the form for an expense, the details for
  // a reimbursement (only cancelled). Opened, a new line is seen: its dot goes.
  let reimbursementId = $state<string | null>(null);
  let openedReimbursement = $derived(reimbursementId ? rawExpenses.find((e) => e.id === reimbursementId) ?? null : null);

  function openExpense(expense: Expense) {
      activeKimpay?.markSeen([expense.id]);
      if (!expense.is_reimbursement) {
          reimbursementId = null;
          showExpenseSheet(kimpayId, { expenseId: expense.id });
          return;
      }
      // Beside the list (computers): in place of the expense open.
      const open = expenseSheet.controls;
      const show = () => {
          open?.close();
          reimbursementId = expense.id;
      };
      if (open?.hasChanges()) confirmDiscard(show);
      else show();
  }

  /** The same again, from the line's hover actions (computers). */
  function duplicateExpense(expense: Expense) {
      reimbursementId = null;
      showExpenseSheet(kimpayId, { from: expense.id });
  }

  function cancelReimbursement(id: string) {
      reimbursementId = null;
      requestDelete(id);
  }

  // A new Kimpay: its two first steps (who is in, the first expense) in one
  // card, until both are done or the card is closed. The Members tab then
  // takes over (with a dot while I am alone).
  let others = $derived(participants.filter(p => p.id !== currentUserId));
  let joinedCount = $derived(participants.filter(p => hasJoined(p, currentUserId)).length);
  let membersDone = $derived(others.length > 0);
  let expenseDone = $derived(rawExpenses.length > 0);
  let setupKey = $derived(`${STORAGE_KEYS.SETUP_DISMISSED_PREFIX}${kimpayId}`);
  // Read again for each Kimpay; set right away when closed.
  let setupDismissed = $derived(prefs.get(setupKey) === 'true');
  let showSetup = $derived(
      !isLoading && !!activeKimpay?.kimpay && !offlineStore.isOffline && !setupDismissed && !(membersDone && expenseDone)
  );

  function dismissSetup() {
      setupDismissed = true;
      prefs.set(setupKey, 'true');
  }
  let newMember = $state("");
  let isInviteOpen = $state(false);

  // Optimistic: the field is free for the next name at once.
  async function addMember() {
      const name = newMember.trim();
      if (!name || !activeKimpay) return;
      newMember = "";
      try {
          await activeKimpay.addParticipant(name);
      } catch (e) {
          console.error(e);
          if (!newMember) newMember = name;
          toasts.error(getErrorMessage(e, $t));
      }
  }

  // Changed or deleted by others since my last look at the history (the
  // additions are the dots above). Loaded again with every change to the group.
  let activities = $state<Activity[]>([]);
  let seenAt = $state(0);
  let activityShown = false;
  $effect(() => {
      const id = kimpayId;
      void activeKimpay?.kimpay?.updated;
      if (!id || offlineStore.isOffline) return;
      seenAt = activitySeenAt(id);
      listActivity(id).then((list) => { activities = list; activityShown = true; }).catch(() => {});
  });
  // Shown here, so seen once I leave the list: like the new expenses, the
  // changes are those since my last visit.
  $effect(() => {
      const id = kimpayId;
      return () => { if (id && activityShown) markActivitySeen(id); };
  });
  let changes = $derived(seenAt ? changesSince(activities, seenAt, currentUserId) : 0);

  let hasNews = $derived(!isLoading && (newIds.size > 0 || changes > 0));

  /** The news seen: no more dots, no more card (until the next ones). */
  function dismissNews() {
      activeKimpay?.markSeen(newIds);
      if (changes > 0) seenAt = markActivitySeen(kimpayId);
  }

  /** A receipt photographed from the empty list: the form reads it. */
  function scanFromList(file: File) {
      pendingReceipt.set(file);
      openExpenseSheet(kimpayId);
  }

  // The swipe of an expense (left: delete) is explained on the
  // first two visits with something to swipe, then left to be known (as the
  // groups' swipe on the home page). Phones only: no swipe with a mouse.
  const swipeHintShown = Number(prefs.get(STORAGE_KEYS.EXPENSE_SWIPE_HINT_SHOWN) ?? 0);
  let canSwipe = $derived(!offlineStore.isOffline && rawExpenses.some((e) => !e.is_reimbursement));
  let showSwipeHint = $derived(swipeHintShown < 2 && canSwipe);
  let swipeHintCounted = false;
  $effect(() => {
      if (swipeHintCounted || !showSwipeHint) return;
      swipeHintCounted = true;
      prefs.set(STORAGE_KEYS.EXPENSE_SWIPE_HINT_SHOWN, String(swipeHintShown + 1));
  });

  function requestDelete(id: string) {
      if (activeKimpay) confirmDeleteExpense(activeKimpay, id);
  }
</script>

<!-- A day's (or the list's) amount: what the group spent, or what it changed for me. -->
{#snippet sectionAmount(section: { total: number; mine: number; reimbursements: number })}
    {#if view === 'me' && isSettled(section.mine)}
        <!-- Nothing changed for me that day (reimbursements between others...). -->
        <span>—</span>
    {:else if view === 'me'}
        <span class="whitespace-nowrap tabular-nums {balanceTone(section.mine) === 'success' ? 'text-success' : 'text-warning'}">
            {balanceSign(section.mine)}{formatAmount(Math.abs(section.mine), kimpayC, $locale)}
        </span>
    {:else if section.reimbursements > 0}
        <span class="whitespace-nowrap">{$t('expense.list.reimbursements_count', { count: String(section.reimbursements) })}</span>
    {:else}
        <span class="whitespace-nowrap tabular-nums">{formatAmount(section.total, kimpayC, $locale)}</span>
    {/if}
{/snippet}

{#snippet filterOption(label: string, selected: boolean, onclick: () => void)}
    <button
        type="button"
        role="option"
        aria-selected={selected}
        tabindex="-1"
        {onclick}
        class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-ring-inset {selected ? 'bg-primary-soft' : ''}"
    >
        <span class="whitespace-nowrap text-sm font-medium">{label}</span>
        {#if selected}
            <Check class="h-4 w-4 text-primary" />
        {/if}
    </button>
{/snippet}

<!-- Computers: wider, and once wide enough (no panel beside it), the
     expenses in columns (see ExpenseItem). -->
<div class="@container mx-auto w-full max-w-2xl space-y-5 px-4 py-4 lg:max-w-5xl">
  <h1 class="sr-only">{$t('nav.expenses')}</h1>

  <OfflineBanner message={$t('expense.offline_warning')} />

  {#snippet step(n: number, done: boolean)}
      <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold {done ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary-soft-foreground'}"
          aria-label={done ? $t('setup.done') : undefined}
      >
          {#if done}<Check class="h-3.5 w-3.5" strokeWidth={3} />{:else}{n}{/if}
      </span>
  {/snippet}

  {#if showSetup}
      <!-- A new Kimpay: the names of the others and their link, then the first expense. -->
      <section class="space-y-4 rounded-card border bg-card p-4 animate-pop-in lg:mx-auto lg:max-w-2xl" aria-labelledby="setup-title" data-testid="setup-card">
          <div class="flex items-center justify-between gap-2">
              <h2 id="setup-title" class="text-base font-semibold">{$t('setup.title')}</h2>
              <button
                  type="button"
                  onclick={dismissSetup}
                  class="-my-2 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={$t('common.close')}
                  title={$t('common.close')}
              >
                  <X class="h-4 w-4" />
              </button>
          </div>

          <div class="flex gap-3">
              {@render step(1, membersDone)}
              <div class="min-w-0 flex-1 space-y-3">
                  <div class="flex flex-wrap items-baseline justify-between gap-x-2">
                      <h3 class="text-base font-medium">{$t('members.setup.title')}</h3>
                      {#if membersDone}
                          <span class="text-sm text-muted-foreground">{$t('setup.joined', { joined: String(joinedCount), count: String(participants.length) })}</span>
                      {/if}
                  </div>
                  <p class="text-sm text-muted-foreground">{membersDone ? $t('members.setup.desc_more') : $t('members.setup.desc')}</p>
                  {#if others.length > 0}
                      <ul class="flex flex-wrap gap-2" aria-label={$t('nav.members')}>
                          {#each others as p (p.id)}
                              <li class="flex h-9 items-center gap-2 rounded-full bg-muted pl-1 pr-3 text-sm font-medium">
                                  <Avatar name={p.name} record={p} class="h-7 w-7 text-[0.625rem]" />
                                  {p.name}
                              </li>
                          {/each}
                      </ul>
                  {/if}
                  <div class="flex gap-2">
                      <Input
                          bind:value={newMember}
                          maxlength={NAME_MAX_LENGTH}
                          placeholder={$t('settings.participants.placeholder')}
                          aria-label={$t('settings.participants.placeholder')}
                          onkeydown={(e) => e.key === 'Enter' && addMember()}
                      />
                      <Button size="icon" class="shrink-0" onclick={addMember} disabled={!newMember.trim()} aria-label={$t('settings.participants.add')}>
                          <Plus />
                      </Button>
                  </div>
                  <Button variant="soft" class="w-full" onclick={() => isInviteOpen = true}>
                      <UserPlus />
                      {$t('members.invite_short')}
                  </Button>
              </div>
          </div>

          <div class="border-t"></div>

          <div class="flex gap-3">
              {@render step(2, expenseDone)}
              <div class="min-w-0 flex-1 space-y-3">
                  <h3 class="text-base font-medium">{$t('setup.first_expense')}</h3>
                  {#if !expenseDone}
                      <div class="flex flex-col gap-2">
                          <Button href="/k/{kimpayId}/add" onclick={opensExpenseSheet(kimpayId)} size="lg" class="w-full">
                              <Plus class="size-5!" />
                              {$t('expense.list.empty.add')}
                          </Button>
                          <ReceiptScanner variant="action" onPick={scanFromList} />
                      </div>
                  {/if}
              </div>
          </div>
      </section>
  {/if}

  {#if hasNews}
  <!-- What the others added or changed since my last visit: each part leads
       to the lines concerned (a dot marks each new line), the cross marks
       it all as seen. -->
  <div class="flex min-h-11 items-center gap-2 rounded-control border bg-card py-1 pl-4 pr-1 animate-pop-in" data-testid="list-summary">
      <span class="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
      <p class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm font-medium text-muted-foreground">
          {#if newIds.size > 0}
              <button type="button" onclick={showNews} class="min-w-0 truncate py-1 text-left hover:text-foreground">
                  {$t('expense.list.new_since', { count: String(newIds.size) })}
              </button>
          {/if}
          {#if newIds.size > 0 && changes > 0}<span aria-hidden="true">·</span>{/if}
          {#if changes > 0}
              <a href="/k/{kimpayId}/settings/activity" class="min-w-0 truncate py-1 text-primary">
                  {$t('activity.changes_since', { count: String(changes) })}
              </a>
          {/if}
      </p>
      <button
          type="button"
          onclick={dismissNews}
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={$t('expense.list.news_dismiss')}
          title={$t('expense.list.news_dismiss')}
      >
          <X class="h-4 w-4" />
      </button>
  </div>
  {/if}

  {#if rawExpenses.length > 0}
      <!-- Right above the bar: tells when the bar got stuck under the header. -->
      <div bind:this={sentinel} class="mb-0! h-0" aria-hidden="true"></div>
      <div
          bind:this={bar}
          class="sticky top-14 z-20 -mx-4 border-b bg-background px-4 py-2 transition-colors duration-150 {isCompact ? 'border-border' : 'border-transparent'}"
      >
          <div class="flex items-center gap-2">
              {#if isCompact}
                  <p class="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
                      <span class="truncate">{current?.shortLabel}</span>
                      {#if current}
                          <span class="shrink-0">{@render sectionAmount(current)}</span>
                      {/if}
                  </p>
                  <button
                      type="button"
                      onclick={openSearch}
                      aria-label={$t('filter.search_placeholder')}
                      class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-control border bg-card transition-colors hover:bg-muted {isFiltering ? 'border-primary/50 text-primary' : 'border-input text-muted-foreground'}"
                  >
                      <Search class="h-4 w-4" />
                      {#if isFiltering}
                          <span class="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary ring-2 ring-background" aria-hidden="true"></span>
                      {/if}
                  </button>
              {:else}
                  <div class="relative min-w-0 flex-1">
                      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                          type="search"
                          id="expense-search"
                          bind:ref={searchInput}
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
                      class="relative flex h-11 w-11 shrink-0 md:hidden items-center justify-center rounded-control border bg-card transition-colors hover:bg-muted {showFilters || activeFilterCount > 0 ? 'border-primary/50 text-primary' : 'border-input text-muted-foreground'}"
                  >
                      <SlidersHorizontal class="h-4 w-4" />
                      {#if activeFilterCount > 0}
                          <span class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">{activeFilterCount}</span>
                      {/if}
                  </button>
              {/if}
              {#if canChooseView}
                  <SegmentedControl
                      options={[
                          { value: 'total', label: $t('expense.view.total') },
                          { value: 'me', label: $t('expense.view.me') },
                      ]}
                      value={view}
                      label={$t('expense.view.label')}
                      onchange={(v) => expenseView.set(v)}
                      class="shrink-0"
                  />
              {/if}
          </div>
      </div>

      {#if filtersShown || isFiltering}
      <div class="-mt-3 space-y-2">
          {#if filtersShown}
              <div class="flex flex-wrap gap-2">
                  <Dropdown position="bottom-left" label={$t('filter.person')} triggerClass={chipClass(!!personFilter)}>
                      {#snippet trigger()}
                          <span>
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

                  <Dropdown position="bottom-left" label={$t('filter.type')} triggerClass={chipClass(typeFilter !== 'all')}>
                      {#snippet trigger()}
                          <span>
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
                      <Dropdown position="bottom-left" label={$t('filter.category')} triggerClass={chipClass(!!categoryFilter)}>
                          {#snippet trigger()}
                              <span>
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

                  <Dropdown position="bottom-left" label={$t('sort.label')} triggerClass={chipClass(false)}>
                      {#snippet trigger()}
                          <span>{sortLabel(sortKey)}</span>
                      {/snippet}
                      {#snippet items(close)}
                          {#each sortKeys as s (s.key)}
                              {@render filterOption(sortLabel(s.key), sortKey === s.key, () => { chooseSort(s.key); close(); })}
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
  {:else if expenses.length === 0 && !showSetup}
      <EmptyState
          title={$t('expense.list.empty.title')}
          description={$t('expense.list.empty.desc')}
          class="animate-pop-in"
      >
          {#snippet icon()}
              <Wallet class="h-12 w-12" />
          {/snippet}
          {#snippet action()}
              <div class="flex w-64 max-w-full flex-col gap-2">
                  <Button href="/k/{kimpayId}/add" onclick={opensExpenseSheet(kimpayId)} size="lg" class="w-full">
                      <Plus class="size-5!" />
                      {$t('expense.list.empty.add')}
                  </Button>
                  <ReceiptScanner variant="action" onPick={scanFromList} />
              </div>
          {/snippet}
      </EmptyState>
  {:else}
      <!-- A wide list: the columns' headings, the amount's sorting by amount. -->
      {#if expenses.length > 0}
      <div class="hidden items-center gap-3 border-b px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground @3xl:flex">
          <span class="w-10 shrink-0"></span>
          <span class="min-w-0 flex-1">{$t('expense.list.col.expense')}</span>
          <span class="w-40 shrink-0">{$t('expense.form.paid_by_label')}</span>
          <span class="w-44 shrink-0">{$t('expense.list.col.for')}</span>
          <!-- Over the room of the lines' hover actions. -->
          <span class="hidden w-[4.75rem] shrink-0 pointer-fine:@3xl:block"></span>
          <button
              type="button"
              onclick={() => chooseSort('amount')}
              class="-my-1 w-32 shrink-0 rounded-md py-1 text-right uppercase transition-colors hover:text-foreground {sortKey === 'amount' ? 'text-primary' : ''}"
              title={$t('sort.label')}
          >
              {sortLabel('amount')}
          </button>
      </div>
      {/if}
      {#each sections as section, i (section.key)}
          <section class="space-y-2 animate-slide-up" data-section={section.key}>
              {#if section.label}
                  <SectionLabel title={section.label}>
                      {#snippet actions()}
                          <span class="text-sm font-semibold text-muted-foreground">{@render sectionAmount(section)}</span>
                      {/snippet}
                  </SectionLabel>
              {/if}
              <ListGroup>
                  {#each section.items as expense (expense.id)}
                      <ExpenseItem
                          {expense}
                          {currentUserId}
                          {participantIds}
                          onOpen={openExpense}
                          onRequestDelete={requestDelete}
                          onDuplicate={duplicateExpense}
                          selected={layout.wide && (page.state.expenseSheet?.expenseId === expense.id || reimbursementId === expense.id)}
                          {view}
                          kimpayCurrency={kimpayC}
                          {exchangeRates}
                          isNew={newIds.has(expense.id)}
                      />
                  {/each}
              </ListGroup>
              {#if i === 0 && showSwipeHint}
                  <p class="px-1 text-xs text-muted-foreground md:hidden">{$t('expense.list.swipe_hint')}</p>
              {/if}
          </section>
      {/each}
  {/if}
</div>

<ExpenseDetailsSheet
    expense={openedReimbursement}
    {currentUserId}
    {participantIds}
    participantsById={activeKimpay?.participantsById ?? new Map()}
    kimpayCurrency={kimpayC}
    {exchangeRates}
    onClose={() => reimbursementId = null}
    onCancelReimbursement={offlineStore.isOffline ? undefined : cancelReimbursement}
/>

<InviteSheet
    isOpen={isInviteOpen}
    onClose={() => isInviteOpen = false}
    link={kimpayId ? `${window.location.origin}/k/${kimpayId}` : ''}
    groupName={activeKimpay?.kimpay?.name ?? 'Kimpay'}
/>
