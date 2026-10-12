<script lang="ts">
  import { type Transaction } from '#lib/balance.js';
  import { ArrowRight, Wallet, Check, ChevronRight, Plus } from "@lucide/svelte";

  import Avatar from '#lib/components/ui/Avatar.svelte';
  import PaymentLinks from '#lib/components/PaymentLinks.svelte';
  import BalanceHero from '#lib/components/ui/BalanceHero.svelte';
  import BalanceBars from '#lib/components/ui/BalanceBars.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { balanceTone, shareOf } from '#lib/balance.js';
  import { expenseView } from '#lib/stores/expenseView.svelte.js';
  import { prefs } from '#lib/utils/prefs.js';
  import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { t, locale } from '#lib/i18n.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import OfflineBanner from '#lib/components/ui/OfflineBanner.svelte';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { formatAmount, convert, DEFAULT_CURRENCY } from '#lib/services/currency.js';
  import { profileStore, hasHandles } from '#lib/stores/profile.svelte.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { EMOJI_CATEGORIES, DEFAULT_EXPENSE_EMOJI, STORAGE_KEYS } from '#lib/constants.js';
  import { groupStats, spendingByCategory } from '#lib/stats.js';
  import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
  import PaymentHandlesSheet from '#lib/components/profile/PaymentHandlesSheet.svelte';

  // Get ActiveKimpay from context
  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let expenses = $derived(activeKimpay?.expenses || []);
  let myId = $derived(activeKimpay?.myParticipantId ?? null);
  let kimpay = $derived(activeKimpay?.kimpay);
  let kimpayDefaultCurrency = $derived(kimpay?.currency || DEFAULT_CURRENCY);
  let exchangeRates = $derived(activeKimpay?.exchangeRates || {});
  
  // Display currency selector state (defaults to Kimpay's currency)
  let displayCurrency = $state('');
  
  // Initialize displayCurrency when kimpay loads
  $effect(() => {
    if (kimpayDefaultCurrency && !displayCurrency) {
      displayCurrency = kimpayDefaultCurrency;
    }
  });
  
  // Helper: convert amount to display currency
  function toDisplayCurrency(amount: number, fromCurrency: string): number {
    return convert(amount, fromCurrency, displayCurrency || DEFAULT_CURRENCY, exchangeRates);
  }
  
  // Reactive transactions calculation
  let transactions = $derived(activeKimpay?.transactions || []);
  
  let isLoading = $derived(activeKimpay?.loading ?? true);

  function openSettleModal(tx: Transaction) {
      if (offlineStore.isOffline) {
          toasts.warning($t('balance.reimbursement.offline_unavailable'));
          return;
      }

      // Show amount in display currency for user understanding
      const displayAmount = toDisplayCurrency(tx.amount, tx.currency);

      modals.confirm({
          title: $t('balance.settle.modal.title'),
          description: $t('balance.settle.modal.desc', {
                amount: formatAmount(displayAmount, displayCurrency, $locale),
                from: tx.from === myId ? $t('common.you') : getName(tx.from),
                to: tx.to === myId ? $t('common.you') : getName(tx.to)
          }),
          confirmText: $t('balance.settle.confirm'),
          cancelText: $t('common.cancel'),
          onConfirm: async () => {
             // Reimbursement is created in the Kimpay's currency (original transaction currency)
             await activeKimpay.addExpense({
                payer: tx.from,
                involved: [tx.to],
                amount: tx.amount,
                currency: tx.currency,
                description: $t('balance.reimbursement'),
                is_reimbursement: true,
                date: new Date().toISOString()
             });
          }
      });
  }

  function getName(id: string) {
      return activeKimpay?.participantsById.get(id)?.name || $t('common.unknown');
  }

  /** "You" for me, the name otherwise. */
  function label(id: string) {
      return id === myId ? $t('common.you') : getName(id);
  }

  let participants = $derived(activeKimpay?.participants || []);
  let myNet = $derived(toDisplayCurrency(activeKimpay?.myBalance ?? 0, kimpayDefaultCurrency));
  let myTone = $derived(balanceTone(myNet));
  let totalExpenses = $derived(toDisplayCurrency(activeKimpay?.totalAmount ?? 0, kimpayDefaultCurrency));
  let myShare = $derived(
      myId ? toDisplayCurrency(shareOf(expenses, participants, myId, kimpayDefaultCurrency, exchangeRates), kimpayDefaultCurrency) : 0
  );

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

  // Everyone's net balance, the biggest creditor first.
  let balanceRows = $derived(
      participants
          .map((p) => ({
              id: p.id,
              name: label(p.id),
              amount: toDisplayCurrency(activeKimpay?.balances[p.id] ?? 0, kimpayDefaultCurrency),
          }))
          .sort((a, b) => b.amount - a.amount)
  );

  // Where the money went: the group's spending or my part, the same choice
  // as on the expense list.
  let view = $derived(myId ? expenseView.choice : 'total');

  let participantIds = $derived(participants.map((p) => p.id));
  let categories = $derived.by(() => {
      const list = spendingByCategory(expenses, kimpayDefaultCurrency, exchangeRates, participantIds, view === 'me' ? myId ?? undefined : undefined);
      const sum = list.reduce((total, c) => total + c.amount, 0);
      return list.map((c) => ({ ...c, share: sum > 0 ? c.amount / sum : 0 }));
  });
  // Worth a breakdown once the group has more than one category.
  let showCategories = $derived(
      spendingByCategory(expenses, kimpayDefaultCurrency, exchangeRates, participantIds).length > 1
  );

  let stats = $derived(groupStats(expenses, kimpayDefaultCurrency, exchangeRates));
</script>

{#snippet stat(title: string, value: string, detail: string)}
    <div class="min-w-0 rounded-card border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">{title}</p>
        <p class="truncate text-lg font-semibold tabular-nums">{value}</p>
        <p class="truncate text-xs text-muted-foreground">{detail}</p>
    </div>
{/snippet}

{#snippet pair(tx: Transaction)}
    <span class="flex shrink-0" aria-hidden="true">
        <Avatar name={getName(tx.from)} record={activeKimpay?.participantsById.get(tx.from)} class="h-8 w-8 text-xs ring-2 ring-card" />
        <Avatar name={getName(tx.to)} record={activeKimpay?.participantsById.get(tx.to)} class="-ml-2 h-8 w-8 text-xs ring-2 ring-card" />
    </span>
    <span class="flex min-w-0 flex-1 items-center gap-1.5 text-base font-medium">
        <span class="truncate">{label(tx.from)}</span>
        <ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" aria-label={$t('balance.pays')} />
        <span class="truncate">{label(tx.to)}</span>
    </span>
    <span class="shrink-0 text-base font-semibold tabular-nums">{formatAmount(toDisplayCurrency(tx.amount, tx.currency), displayCurrency, $locale)}</span>
{/snippet}

<div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-4">
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
                <Button href="/k/{activeKimpay?.id ?? ''}/add" size="lg">
                    <Plus class="size-5!" />
                    {$t('expense.list.empty.add')}
                </Button>
            {/snippet}
         </EmptyState>
    {:else}
        <!-- Me first: where I stand, then what I should do, then the group. -->
        {#if !myId}
            <BalanceHero label={$t('balance.total_group')} amount={totalExpenses} currency={displayCurrency} />
        {:else if transactions.length === 0}
            <BalanceHero label={$t('expense.hero.label')} text={$t('balance.settled.title')} tone="success">
                <span>{$t('expense.hero.total', { amount: formatAmount(totalExpenses, displayCurrency, $locale) })}</span>
            </BalanceHero>
        {:else}
            <BalanceHero
                label={myTone === 'warning' ? $t('balance.you_owe') : myTone === 'success' ? $t('balance.owed_to_you') : $t('expense.hero.label')}
                amount={myTone !== 'neutral' ? myNet : undefined}
                text={$t('balance.settled.title')}
                currency={displayCurrency}
                tone={myTone}
            >
                <span>{$t('expense.hero.total', { amount: formatAmount(totalExpenses, displayCurrency, $locale) })}</span>
                <span>{$t('balance.hero.share', { amount: formatAmount(myShare, displayCurrency, $locale) })}</span>
            </BalanceHero>
        {/if}

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

        {#if transactions.length > 0}
            <section class="space-y-2 animate-slide-up">
                <SectionLabel title={$t('balance.suggested.title')}>
                    {#snippet actions()}
                        <CurrencySelect size="sm" bind:value={displayCurrency} />
                    {/snippet}
                </SectionLabel>
                <ListGroup>
                    {#each transactions as tx, i (i)}
                        {#if myId && (tx.from === myId || tx.to === myId)}
                            <!-- My own payments: explicit actions. -->
                            <div class="space-y-3 px-4 py-3">
                                <div class="flex items-center gap-3">
                                    {@render pair(tx)}
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    {#if tx.from === myId}
                                        <PaymentLinks to={activeKimpay?.participantsById.get(tx.to)} amount={tx.amount} currency={tx.currency} />
                                    {/if}
                                    <Button size="sm" variant="outline" onclick={() => openSettleModal(tx)}>
                                        <Check />
                                        {$t('balance.mark_settled')}
                                    </Button>
                                </div>
                            </div>
                        {:else}
                            <button
                                type="button"
                                class="flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left transition-colors duration-150 first:rounded-t-[inherit] last:rounded-b-[inherit] hover:bg-muted/60 disabled:pointer-events-none"
                                onclick={() => openSettleModal(tx)}
                                disabled={!myId}
                                aria-label={$t('balance.settle.modal.title')}
                            >
                                {@render pair(tx)}
                                {#if myId}
                                    <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
                                {/if}
                            </button>
                        {/if}
                    {/each}
                </ListGroup>
            </section>
        {/if}

        <section class="space-y-2 animate-slide-up">
            <SectionLabel title={$t('readonly.balances')}>
                {#snippet actions()}
                    {#if transactions.length === 0}
                        <CurrencySelect size="sm" bind:value={displayCurrency} />
                    {/if}
                {/snippet}
            </SectionLabel>
            <BalanceBars rows={balanceRows} currency={displayCurrency} />
        </section>

        {#if showCategories}
            <section class="space-y-2 animate-slide-up">
                <SectionLabel title={$t('balance.categories.title')}>
                    {#snippet actions()}
                        {#if myId}
                            <SegmentedControl
                                options={[
                                    { value: 'total', label: $t('expense.view.total') },
                                    { value: 'me', label: $t('expense.view.me') },
                                ]}
                                value={view}
                                label={$t('expense.view.label')}
                                onchange={(v) => expenseView.set(v)}
                            />
                        {/if}
                    {/snippet}
                </SectionLabel>
                {#if categories.length === 0}
                    <p class="rounded-card border bg-card px-4 py-3 text-sm text-muted-foreground">{$t('balance.categories.none')}</p>
                {:else}
                    <ListGroup>
                        {#each categories as category (category.key)}
                            <!-- To the list, filtered on that category. -->
                            <a
                                href="/k/{activeKimpay?.id ?? ''}?category={category.key}"
                                data-sveltekit-replacestate
                                class="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 first:rounded-t-[inherit] last:rounded-b-[inherit] hover:bg-muted/60"
                            >
                                <span class="w-6 shrink-0 text-center text-lg" aria-hidden="true">{EMOJI_CATEGORIES[category.key]!.emojis[0]}</span>
                                <span class="min-w-0 flex-1 space-y-1.5">
                                    <span class="flex items-baseline gap-2 text-sm">
                                        <span class="truncate font-medium">{$t(EMOJI_CATEGORIES[category.key]!.labelKey)}</span>
                                        <span class="shrink-0 text-muted-foreground tabular-nums">{Math.round(category.share * 100)} %</span>
                                    </span>
                                    <span class="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                        <span class="block h-full rounded-full bg-primary" style="width: {Math.max(category.share * 100, 2)}%"></span>
                                    </span>
                                </span>
                                <span class="shrink-0 text-base font-semibold tabular-nums">{formatAmount(toDisplayCurrency(category.amount, kimpayDefaultCurrency), displayCurrency, $locale)}</span>
                                <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
                            </a>
                        {/each}
                    </ListGroup>
                {/if}
            </section>
        {/if}

        {#if stats.expenseCount >= 3}
            <section class="space-y-2 animate-slide-up">
                <SectionLabel title={$t('balance.stats.title')} />
                <div class="grid grid-cols-2 gap-2">
                    {@render stat(
                        $t('balance.stats.per_day'),
                        formatAmount(toDisplayCurrency(stats.perDay, kimpayDefaultCurrency), displayCurrency, $locale),
                        $t('balance.stats.days', { count: String(stats.days) }),
                    )}
                    {#if stats.biggest}
                        {@render stat(
                            $t('balance.stats.biggest'),
                            formatAmount(toDisplayCurrency(stats.biggestAmount, kimpayDefaultCurrency), displayCurrency, $locale),
                            `${stats.biggest.icon || DEFAULT_EXPENSE_EMOJI} ${stats.biggest.description}`,
                        )}
                    {/if}
                    {#if stats.topPayer}
                        {@render stat(
                            $t('balance.stats.top_payer'),
                            label(stats.topPayer.id),
                            formatAmount(toDisplayCurrency(stats.topPayer.amount, kimpayDefaultCurrency), displayCurrency, $locale),
                        )}
                    {/if}
                    {@render stat(
                        $t('balance.stats.count'),
                        String(stats.expenseCount),
                        stats.reimbursementCount > 0 ? $t('balance.stats.reimbursements', { count: String(stats.reimbursementCount) }) : '',
                    )}
                </div>
            </section>
        {/if}
    {/if}
</div>

<PaymentHandlesSheet isOpen={isPaymentOpen} onClose={() => isPaymentOpen = false} onSaved={showMyHandles} />
