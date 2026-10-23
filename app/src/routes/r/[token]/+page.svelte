<script lang="ts">
    import { layout } from '#lib/stores/layout.svelte.js';
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { CircleCheck, Eye, Link, Plus } from '@lucide/svelte';
    import { t, locale } from '#lib/i18n.js';
    import { fetchReadonlyKimpay, type ReadonlyKimpay } from '#lib/services/readonly.js';
    import { getExchangeRates, formatAmount } from '#lib/services/currency.js';
    import { calculateBalances, calculateDebts, totalSpent } from '#lib/balance.js';
    import { DEFAULT_KIMPAY_EMOJI } from '#lib/constants.js';
    import { dayLabel, groupByDay } from '#lib/utils/date.js';
    import ExpenseItem from '#lib/components/expense/ExpenseItem.svelte';
    import ExpenseDetailsSheet from '#lib/components/expense/ExpenseDetailsSheet.svelte';
    import PaymentPair from '#lib/components/balance/PaymentPair.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import type { Expense } from '#lib/types.js';
    import Badge from '#lib/components/ui/Badge.svelte';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import BalanceBars from '#lib/components/ui/BalanceBars.svelte';
    import BalanceHero from '#lib/components/ui/BalanceHero.svelte';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
    import EmptyState from '#lib/components/ui/EmptyState.svelte';
    import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';

    let data = $state<ReadonlyKimpay | null>(null);
    let rates = $state<Record<string, number>>({});
    let error = $state<'not_found' | 'generic' | null>(null);

    onMount(async () => {
        // Today's rates only matter for expenses without a frozen rate.
        getExchangeRates()
            .then((r) => (rates = r))
            .catch(() => {});
        try {
            data = await fetchReadonlyKimpay(page.params.token ?? '');
        } catch (e) {
            error = (e as { status?: number }).status === 404 ? 'not_found' : 'generic';
        }
    });

    let currency = $derived(data?.currency ?? 'EUR');
    let byId = $derived(new Map((data?.participants ?? []).map((p) => [p.id, p])));
    let balances = $derived(data ? calculateBalances(data.expenses, data.participants, currency, rates) : {});
    let transactions = $derived(data ? calculateDebts(data.expenses, data.participants, currency, rates) : []);
    let total = $derived(data ? totalSpent(data.expenses, currency, rates) : 0);
    let ranked = $derived([...(data?.participants ?? [])].sort((a, b) => (balances[b.id] ?? 0) - (balances[a.id] ?? 0)));

    const nameOf = (id: string) => byId.get(id)?.name ?? $t('common.unknown');

    // The latest day first, as in the app.
    let days = $derived(
        groupByDay([...(data?.expenses ?? [])].sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))))
    );
    let participantIds = $derived((data?.participants ?? []).map((p) => p.id));
    // A line touched: its details, in a sheet.
    let opened = $state<Expense | null>(null);
</script>

<svelte:head>
    <title>{data ? `${data.name} - Kimpay` : 'Kimpay'}</title>
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- Computers: the balances on the left, the expenses on the right (making
     room for an expense's panel). -->
<div class="{layout.panels > 0 ? 'lg:pr-[calc(var(--panel-width)-var(--scrollbar-width,0px))]' : ''}">
<div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-4 pb-12 lg:max-w-5xl">
    {#if error}
        <EmptyState
            title={error === 'not_found' ? $t('readonly.not_found.title') : $t('error.generic.title')}
            description={error === 'not_found' ? $t('readonly.not_found.desc') : $t('error.generic')}
            class="mt-12 animate-pop-in"
        >
            {#snippet icon()}
                <Link class="h-12 w-12" />
            {/snippet}
        </EmptyState>
    {:else if !data}
        <ListSkeleton count={4} />
    {:else}
      <div class="space-y-5 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:space-y-0">
      <div class="space-y-5 lg:col-start-1">
        <header class="flex items-center gap-3">
            <IconTile size="lg" tone="card">{data.icon || DEFAULT_KIMPAY_EMOJI}</IconTile>
            <div class="min-w-0 space-y-1">
                <h1 class="truncate text-xl font-bold">{data.name}</h1>
                <Badge tone="neutral"><Eye class="h-3 w-3" />{$t('readonly.badge')}</Badge>
            </div>
        </header>

        <BalanceHero label={$t('balance.total_group')} amount={total} {currency}>
            <span>{data.expenses.length} {$t('expense.list.items')} · {$t('expense.list.people', { count: String(data.participants.length) })}</span>
        </BalanceHero>

        <section class="space-y-2">
            <SectionLabel title={$t('balance.suggested.title')} />
            {#if transactions.length === 0}
                <div class="flex items-center gap-3 rounded-card bg-success-soft p-4 text-success">
                    <CircleCheck class="h-5 w-5 shrink-0" />
                    <span class="text-sm font-semibold">{$t('balance.settled.title')}</span>
                </div>
            {:else}
                <ListGroup>
                    {#each transactions as tx, i (i)}
                        <div class="flex min-h-14 items-center gap-3 px-4 py-3">
                            <PaymentPair
                                from={{ name: nameOf(tx.from), record: byId.get(tx.from) }}
                                to={{ name: nameOf(tx.to), record: byId.get(tx.to) }}
                                amount={formatAmount(tx.amount, tx.currency, $locale)}
                            />
                        </div>
                    {/each}
                </ListGroup>
            {/if}
        </section>

        <section class="space-y-2">
            <SectionLabel title={$t('readonly.balances')} />
            <BalanceBars rows={ranked.map((p) => ({ id: p.id, name: p.name, amount: balances[p.id] ?? 0 }))} {currency} />
        </section>
      </div>

        <section class="space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <SectionLabel title={$t('nav.expenses')} />
            {#if data.expenses.length === 0}
                <p class="px-1 text-sm text-muted-foreground">{$t('expense.list.empty.title')}</p>
            {:else}
                {#each days as day (day.key)}
                    <div class="space-y-2">
                        <h3 class="px-1 text-sm font-semibold text-muted-foreground">
                            {dayLabel(day.key, $locale, { today: $t('datepicker.today'), yesterday: $t('date.yesterday') })}
                        </h3>
                        <ListGroup>
                            {#each day.items as e (e.id)}
                                <ExpenseItem
                                    expense={e}
                                    readonly
                                    currentUserId={null}
                                    {participantIds}
                                    onOpen={(expense) => (opened = expense)}
                                    kimpayCurrency={currency}
                                    exchangeRates={rates}
                                />
                            {/each}
                        </ListGroup>
                    </div>
                {/each}
            {/if}
        </section>

        <!-- Seen by someone outside the Kimpay: the app, in one tap. -->
        <section class="space-y-3 rounded-card bg-primary-soft p-5 text-center lg:col-start-1 lg:mt-5">
            <div class="space-y-1">
                <h2 class="text-lg font-bold text-balance">{$t('readonly.cta.title')}</h2>
                <p class="text-sm text-muted-foreground">{$t('readonly.cta.desc')}</p>
            </div>
            <Button href="/" class="w-full sm:w-auto">
                <Plus />
                {$t('home.tile.create')}
            </Button>
        </section>
      </div>
    {/if}
</div>
</div>

<ExpenseDetailsSheet
    expense={opened}
    currentUserId={null}
    {participantIds}
    participantsById={byId}
    kimpayCurrency={currency}
    exchangeRates={rates}
    onClose={() => (opened = null)}
/>
