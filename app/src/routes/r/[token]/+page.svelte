<script lang="ts">
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { ArrowRight, CircleCheck, Eye, Link } from '@lucide/svelte';
    import { t, locale } from '#lib/i18n.js';
    import { fetchReadonlyKimpay, type ReadonlyKimpay } from '#lib/services/readonly.js';
    import { getExchangeRates, formatAmount } from '#lib/services/currency.js';
    import { calculateBalances, calculateDebts, totalSpent } from '#lib/balance.js';
    import { DEFAULT_KIMPAY_EMOJI } from '#lib/constants.js';
    import { dayLabel, groupByDay } from '#lib/utils/date.js';
    import ExpenseItem from '#lib/components/expense/ExpenseItem.svelte';
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

    // The latest day first, as in the app; one line opened at a time.
    let days = $derived(
        groupByDay([...(data?.expenses ?? [])].sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))))
    );
    let participantIds = $derived((data?.participants ?? []).map((p) => p.id));
    let expandedId = $state<string | null>(null);
</script>

<svelte:head>
    <title>{data ? `${data.name} - Kimpay` : 'Kimpay'}</title>
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-4 pb-12">
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
                        <div class="flex items-center gap-3 px-4 py-3">
                            <span class="flex min-w-0 flex-1 items-center gap-1.5 text-base font-medium">
                                <span class="truncate">{nameOf(tx.from)}</span>
                                <ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" aria-label={$t('balance.pays')} />
                                <span class="truncate">{nameOf(tx.to)}</span>
                            </span>
                            <span class="shrink-0 text-base font-semibold tabular-nums">{formatAmount(tx.amount, tx.currency, $locale)}</span>
                        </div>
                    {/each}
                </ListGroup>
            {/if}
        </section>

        <section class="space-y-2">
            <SectionLabel title={$t('readonly.balances')} />
            <BalanceBars rows={ranked.map((p) => ({ id: p.id, name: p.name, amount: balances[p.id] ?? 0 }))} {currency} />
        </section>

        <section class="space-y-2">
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
                                    {expandedId}
                                    kimpayId=""
                                    onToggleExpand={(id) => (expandedId = expandedId === id ? null : id)}
                                    onRequestDelete={() => {}}
                                    onOpenGallery={() => {}}
                                    participantsById={byId}
                                    kimpayCurrency={currency}
                                    exchangeRates={rates}
                                />
                            {/each}
                        </ListGroup>
                    </div>
                {/each}
            {/if}
        </section>

        <p class="text-center text-xs text-muted-foreground">
            {$t('readonly.footer')} <a href="/" class="font-semibold text-primary hover:underline">Kimpay</a>
        </p>
    {/if}
</div>
