<script lang="ts">
  import { type Transaction } from '#lib/balance.js';
  import { ArrowRight, Wallet, Check, ChevronRight } from "@lucide/svelte";

  import Avatar from '#lib/components/ui/Avatar.svelte';
  import PaymentLinks from '#lib/components/PaymentLinks.svelte';
  import BalanceHero from '#lib/components/ui/BalanceHero.svelte';
  import BalanceBars from '#lib/components/ui/BalanceBars.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { shareOf } from '#lib/balance.js';
  import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { t, locale } from '#lib/i18n.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import OfflineBanner from '#lib/components/ui/OfflineBanner.svelte';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { formatAmount, convert, DEFAULT_CURRENCY } from '#lib/services/currency.js';

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
          modals.alert({
              message: $t('balance.reimbursement.offline_unavailable')
          });
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
  let totalExpenses = $derived(toDisplayCurrency(activeKimpay?.totalAmount ?? 0, kimpayDefaultCurrency));
  let myShare = $derived(
      myId ? toDisplayCurrency(shareOf(expenses, participants, myId, kimpayDefaultCurrency, exchangeRates), kimpayDefaultCurrency) : 0
  );

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
</script>

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
                label={myNet < -0.005 ? $t('balance.you_owe') : myNet > 0.005 ? $t('balance.owed_to_you') : $t('expense.hero.label')}
                amount={Math.abs(myNet) > 0.005 ? myNet : undefined}
                text={$t('balance.settled.title')}
                currency={displayCurrency}
                tone={myNet < -0.005 ? 'warning' : myNet > 0.005 ? 'success' : 'neutral'}
            >
                <span>{$t('expense.hero.total', { amount: formatAmount(totalExpenses, displayCurrency, $locale) })}</span>
                <span>{$t('balance.hero.share', { amount: formatAmount(myShare, displayCurrency, $locale) })}</span>
            </BalanceHero>
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
    {/if}
</div>
