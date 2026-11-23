<script lang="ts">
  import { type Transaction } from '#lib/balance.js';
  import { Wallet, ChevronDown, ChevronRight, Plus, CircleCheck } from "@lucide/svelte";

  import DebtCard from '#lib/components/balance/DebtCard.svelte';
  import PaymentPair from '#lib/components/balance/PaymentPair.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { prefs } from '#lib/utils/prefs.js';
  import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { t, locale } from '#lib/i18n.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import OfflineBanner from '#lib/components/ui/OfflineBanner.svelte';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { opensExpenseSheet } from '#lib/expenseSheet.js';
  import { formatAmount, convert, DEFAULT_CURRENCY } from '#lib/services/currency.js';
  import { profileStore, hasHandles } from '#lib/stores/profile.svelte.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { EMOJI_CATEGORIES, DEFAULT_EXPENSE_EMOJI, STORAGE_KEYS, categoryColor, type EmojiCategoryKey } from '#lib/constants.js';
  import { groupStats, spendingByCategory } from '#lib/stats.js';
  import PaymentHandlesSheet from '#lib/components/profile/PaymentHandlesSheet.svelte';
  import SettleSheet from '#lib/components/balance/SettleSheet.svelte';
  import CategorySheet from '#lib/components/balance/CategorySheet.svelte';

  // Get ActiveKimpay from context
  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let expenses = $derived(activeKimpay?.expenses || []);
  let myId = $derived(activeKimpay?.myParticipantId ?? null);
  let kimpay = $derived(activeKimpay?.kimpay);
  let kimpayDefaultCurrency = $derived(kimpay?.currency || DEFAULT_CURRENCY);
  let exchangeRates = $derived(activeKimpay?.exchangeRates || {});

  // Display currency: the group's (which follows it once loaded, or when it
  // changes), until another one is picked here.
  let chosenCurrency = $state('');
  let displayCurrency = $derived(chosenCurrency || kimpayDefaultCurrency);

  // Helper: convert amount to display currency
  function toDisplayCurrency(amount: number, fromCurrency: string): number {
    return convert(amount, fromCurrency, displayCurrency || DEFAULT_CURRENCY, exchangeRates);
  }

  // Reactive transactions calculation
  let transactions = $derived(activeKimpay?.transactions || []);

  let isLoading = $derived(activeKimpay?.loading ?? true);

  // Recording a payment: the amount due, or part of it, on a chosen day.
  let settling = $state<Transaction | null>(null);

  function openSettleModal(tx: Transaction) {
      if (offlineStore.isOffline) {
          toasts.warning($t('balance.reimbursement.offline_unavailable'));
          return;
      }
      settling = tx;
  }

  /** Record the payment: a reimbursement, in the Kimpay's currency. */
  async function settle(tx: Transaction, amount = tx.amount, date = new Date().toISOString()) {
      await activeKimpay.recordReimbursement(tx, $t('balance.reimbursement'), amount, date);
  }

  // Paid in PayPal or Revolut: back in the app, ask whether it went through
  // (the payment is not recorded until marked as settled).
  let opened = $state<{ to: string; service: string; left: boolean } | null>(null);

  $effect(() => {
      const onVisibility = () => {
          if (!opened) return;
          if (document.visibilityState === 'hidden') {
              opened.left = true;
              return;
          }
          if (!opened.left) return;
          const { to, service } = opened;
          opened = null;
          // Still owed (nobody settled it meanwhile)?
          const tx = transactions.find((t) => t.from === myId && t.to === to);
          if (tx && !offlineStore.isOffline) askPaid(tx, service);
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
  });

  function askPaid(tx: Transaction, service: string) {
      modals.confirm({
          title: $t('balance.paid_back.title', { name: getName(tx.to) }),
          description: $t('balance.paid_back.desc', {
              amount: formatAmount(toDisplayCurrency(tx.amount, tx.currency), displayCurrency, $locale),
              service,
          }),
          confirmText: $t('balance.paid_back.confirm'),
          cancelText: $t('balance.paid_back.not_yet'),
          onConfirm: () => settle(tx),
      });
  }

  function getName(id: string) {
      return activeKimpay?.participantsById.get(id)?.name || $t('common.unknown');
  }

  /** "You" for me, the name otherwise. */
  function label(id: string) {
      return id === myId ? $t('common.you') : getName(id);
  }

  // My debts first, as cards with their actions; the others' in a list.
  let myTransactions = $derived(myId ? transactions.filter((tx) => tx.from === myId || tx.to === myId) : []);
  let otherTransactions = $derived(transactions.filter((tx) => !myTransactions.includes(tx)));

  function shown(tx: Transaction): string {
      return formatAmount(toDisplayCurrency(tx.amount, tx.currency), displayCurrency, $locale);
  }

  // Someone owes me and cannot pay me in one tap: offer to show my payment
  // links here (they are private until shown in a group).
  let owingMe = $derived([...new Set(transactions.filter((tx) => myId && tx.to === myId).map((tx) => tx.from))]);
  let nudgeKey = $derived(`${STORAGE_KEYS.PAYMENT_NUDGE_DISMISSED_PREFIX}${activeKimpay?.id ?? ''}`);
  // Read again for each group; set right away when dismissed.
  let nudgeDismissed = $derived(prefs.get(nudgeKey) === 'true');
  let showNudge = $derived(
      !!myId && owingMe.length > 0 && !nudgeDismissed && !offlineStore.isOffline &&
          !hasHandles(activeKimpay?.participantsById.get(myId))
  );
  let isPaymentOpen = $state(false);
  let isShowing = $state(false);

  async function showMyHandles() {
      // Only an account can show payment links in a group.
      if (!auth.user) {
          modals.register({ description: $t('profile.payment.needs_account') });
          return;
      }
      if (!profileStore.hasHandles) {
          isPaymentOpen = true;
          return;
      }
      isShowing = true;
      try {
          await profileStore.showInActiveGroup(true);
          toasts.success($t('profile.payment.shown'));
      } catch (e) {
          console.error("Failed to show payment handles", e);
          toasts.error(getErrorMessage(e, $t));
      } finally {
          isShowing = false;
      }
  }

  function dismissNudge() {
      nudgeDismissed = true;
      prefs.set(nudgeKey, 'true');
  }

  // Where the money went: the group's spending, per category.
  let categories = $derived.by(() => {
      const list = spendingByCategory(expenses, kimpayDefaultCurrency, exchangeRates);
      const sum = list.reduce((total, c) => total + c.amount, 0);
      return list.map((c) => ({ ...c, share: sum > 0 ? c.amount / sum : 0 }));
  });
  let categoriesTotal = $derived(categories.reduce((total, c) => total + c.amount, 0));
  // A few figures more, folded until asked for.
  let stats = $derived(groupStats(expenses, kimpayDefaultCurrency, exchangeRates));
  let showStats = $state(false);

  function money(amount: number): string {
      return formatAmount(toDisplayCurrency(amount, kimpayDefaultCurrency), displayCurrency, $locale);
  }

  // A category opened: its sheet, with its share of the spending.
  let openedCategory = $state<EmojiCategoryKey | null>(null);
  let openedShare = $derived(categories.find((c) => c.key === openedCategory)?.share ?? 0);

  function openCategory(key: EmojiCategoryKey) {
      openedCategory = key;
  }

  // "42 %" in French, "42%" in English: the language's own way.
  let percent = $derived(new Intl.NumberFormat($locale, { style: 'percent', maximumFractionDigits: 0 }));

  // The bar in words: "Food 35 %, Lodging 27 %…"
  let categoriesSummary = $derived(
      categories.map((c) => `${$t(EMOJI_CATEGORIES[c.key]!.labelKey)} ${percent.format(c.share)}`).join(', ')
  );
</script>

{#snippet stat(title: string, value: string, detail: string)}
    <li class="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
        <span class="min-w-0">
            <span class="block text-sm font-medium">{title}</span>
            <span class="block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
        <span class="shrink-0 text-base font-semibold tabular-nums">{value}</span>
    </li>
{/snippet}

<!-- Computers: as wide as the expense list. -->
<div class="@container mx-auto w-full max-w-2xl space-y-5 px-4 py-4 lg:max-w-5xl">
    <h1 class="sr-only">{$t('balance.title')}</h1>

    <OfflineBanner message={$t('balance.offline_warning')} />

    {#if isLoading}
        <ListSkeleton count={3} />
    {:else if expenses.length === 0}
         <EmptyState
            title={$t('balance.empty.title')}
            description={$t('balance.empty.desc')}
            class="animate-pop-in"
         >
            {#snippet icon()}
                <Wallet class="h-12 w-12" />
            {/snippet}
            {#snippet action()}
                <Button href="/k/{activeKimpay?.id ?? ''}/add" onclick={opensExpenseSheet(activeKimpay?.id ?? '')} size="lg">
                    <Plus class="size-5!" />
                    {$t('expense.list.empty.add')}
                </Button>
            {/snippet}
         </EmptyState>
    {:else}
        <!-- What to do first (the payments), then where the money went;
             a few figures more on demand. -->
        {#if showNudge}
            <section class="space-y-3 rounded-card bg-primary-soft p-4 animate-pop-in">
                <div class="space-y-1">
                    <p class="text-base font-semibold">
                        {owingMe.length === 1 ? $t('payment.nudge.title_one', { name: getName(owingMe[0]!) }) : $t('payment.nudge.title_many')}
                    </p>
                    <p class="text-sm text-muted-foreground">
                        {profileStore.hasHandles ? $t('payment.nudge.desc') : $t('payment.nudge.desc_empty')}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button size="sm" onclick={showMyHandles} disabled={isShowing}>
                        {profileStore.hasHandles ? $t('payment.nudge.show') : $t('profile.payment.add')}
                    </Button>
                    <Button size="sm" variant="ghost" onclick={dismissNudge}>{$t('payment.nudge.later')}</Button>
                </div>
            </section>
        {/if}

        <section class="space-y-2 animate-slide-up">
            <!-- The amounts of the page, in another currency if needed. -->
            <SectionLabel title={$t('balance.suggested.title')}>
                {#snippet actions()}
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{$t('balance.display_in')}</span>
                        <CurrencySelect size="sm" value={displayCurrency} onchange={(code) => chosenCurrency = code} />
                    </div>
                {/snippet}
            </SectionLabel>
            {#if transactions.length === 0}
                <!-- Nobody owes anybody. -->
                <p class="flex items-center gap-2.5 rounded-card bg-success-soft px-4 py-3 text-base font-semibold text-success" data-testid="settled">
                    <CircleCheck class="h-5 w-5 shrink-0" />
                    {$t('balance.settled.title')}
                </p>
            {/if}
            {#each myTransactions as tx (`${tx.from}-${tx.to}`)}
                {@const iOwe = tx.from === myId}
                <DebtCard
                    other={activeKimpay?.participantsById.get(iOwe ? tx.to : tx.from)}
                    {iOwe}
                    amount={shown(tx)}
                    payAmount={tx.amount}
                    payCurrency={tx.currency}
                    onSettle={() => openSettleModal(tx)}
                    onpay={(service) => (opened = { to: tx.to, service, left: false })}
                />
            {/each}
            {#if otherTransactions.length > 0}
                <ListGroup>
                    {#each otherTransactions as tx (`${tx.from}-${tx.to}`)}
                        <!-- Between two others: recorded by anyone of the Kimpay. -->
                        <button
                            type="button"
                            class="flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left transition-colors duration-150 first:rounded-t-[inherit] last:rounded-b-[inherit] focus-ring-inset hover:bg-muted/60 disabled:pointer-events-none"
                            onclick={() => openSettleModal(tx)}
                            disabled={!myId}
                        >
                            <PaymentPair
                                from={{ name: label(tx.from), record: activeKimpay?.participantsById.get(tx.from) }}
                                to={{ name: label(tx.to), record: activeKimpay?.participantsById.get(tx.to) }}
                                amount={shown(tx)}
                            />
                            {#if myId}
                                <span class="sr-only">{$t('balance.mark_settled')}</span>
                                <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
                            {/if}
                        </button>
                    {/each}
                </ListGroup>
            {/if}
        </section>

        {#if categories.length > 0}
            <section class="space-y-2 animate-slide-up">
                <SectionLabel title={$t('balance.categories.title')} />
                <div class="space-y-3 rounded-card border bg-card px-4 pb-2 pt-4">
                    <div class="flex items-baseline justify-between gap-3">
                        <span class="text-2xl font-bold tabular-nums">{formatAmount(toDisplayCurrency(categoriesTotal, kimpayDefaultCurrency), displayCurrency, $locale)}</span>
                        <span class="text-sm text-muted-foreground">{$t('expense.list.count', { count: String(stats.expenseCount) })}</span>
                    </div>
                    <!-- The whole at a glance, once there is more than one
                         category; the rows below say it in words. -->
                    {#if categories.length > 1}
                        <div class="flex h-3.5 gap-0.5" role="img" aria-label={categoriesSummary} data-testid="category-bar">
                            {#each categories as category (category.key)}
                                <span
                                    class="min-w-1 first:rounded-l-full last:rounded-r-full"
                                    style="flex-grow: {category.amount}; background-color: {categoryColor(category.key)}"
                                ></span>
                            {/each}
                        </div>
                    {/if}
                    <ul class="-mx-2">
                        {#each categories as category (category.key)}
                            <li>
                                <button
                                    type="button"
                                    aria-haspopup="dialog"
                                    onclick={() => openCategory(category.key)}
                                    class="flex min-h-11 w-full items-center gap-2.5 rounded-control px-2 text-left transition-colors duration-150 hover:bg-muted/60 focus-ring-inset"
                                >
                                    <span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" style="background-color: {categoryColor(category.key)}" aria-hidden="true"></span>
                                    <span class="shrink-0 text-base" aria-hidden="true">{EMOJI_CATEGORIES[category.key]!.emojis[0]}</span>
                                    <span class="min-w-0 truncate text-sm font-medium">{$t(EMOJI_CATEGORIES[category.key]!.labelKey)}</span>
                                    <span class="flex-1 text-sm text-muted-foreground tabular-nums">{percent.format(category.share)}</span>
                                    <span class="shrink-0 text-base font-semibold tabular-nums">{formatAmount(toDisplayCurrency(category.amount, kimpayDefaultCurrency), displayCurrency, $locale)}</span>
                                </button>
                            </li>
                        {/each}
                    </ul>
                </div>
            </section>
        {/if}

        {#if stats.expenseCount >= 3}
            <section class="space-y-2">
                <button
                    type="button"
                    onclick={() => showStats = !showStats}
                    aria-expanded={showStats}
                    aria-controls="balance-stats"
                    class="-mx-2 flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-ring-inset"
                >
                    {$t('balance.more')}
                    <ChevronDown class="h-4 w-4 transition-transform duration-200 {showStats ? 'rotate-180' : ''}" />
                </button>
                {#if showStats}
                    <ul id="balance-stats" class="divide-y divide-border rounded-card border bg-card animate-pop-in" aria-label={$t('balance.stats.title')}>
                        {@render stat($t('balance.stats.per_day'), money(stats.perDay), $t('balance.stats.days', { count: String(stats.days) }))}
                        {#if stats.biggest}
                            {@render stat($t('balance.stats.biggest'), money(stats.biggestAmount), `${stats.biggest.icon || DEFAULT_EXPENSE_EMOJI} ${stats.biggest.description}`)}
                        {/if}
                        {#if stats.topPayer}
                            {@render stat($t('balance.stats.top_payer'), label(stats.topPayer.id), money(stats.topPayer.amount))}
                        {/if}
                        {@render stat(
                            $t('balance.stats.count'),
                            String(stats.expenseCount),
                            stats.reimbursementCount > 0 ? $t('balance.stats.reimbursements', { count: String(stats.reimbursementCount) }) : '',
                        )}
                    </ul>
                {/if}
            </section>
        {/if}
    {/if}
</div>

<PaymentHandlesSheet isOpen={isPaymentOpen} onClose={() => isPaymentOpen = false} onSaved={showMyHandles} />
<SettleSheet
    tx={settling}
    from={settling ? label(settling.from) : ''}
    to={settling ? label(settling.to) : ''}
    {displayCurrency}
    {exchangeRates}
    onClose={() => settling = null}
    onConfirm={async (amount, date) => {
        try {
            await settle(settling!, amount, date);
        } catch (e) {
            console.error("Failed to record the reimbursement", e);
            toasts.error(getErrorMessage(e, $t));
            throw e;
        }
    }}
/>
{#if activeKimpay}
    <CategorySheet
        category={openedCategory}
        share={openedShare}
        {displayCurrency}
        {activeKimpay}
        onClose={() => openedCategory = null}
    />
{/if}
