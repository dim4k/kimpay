<script lang="ts">
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { ArrowRight, CircleCheck, Eye, HandCoins, Link } from '@lucide/svelte';
    import { t, locale } from '#lib/i18n.js';
    import { fetchReadonlyKimpay, type ReadonlyKimpay } from '#lib/services/readonly.js';
    import { getExchangeRates, formatAmount } from '#lib/services/currency.js';
    import { calculateBalances, calculateDebts, totalSpent } from '#lib/balance.js';
    import { DEFAULT_EXPENSE_EMOJI, DEFAULT_KIMPAY_EMOJI } from '#lib/constants.js';
    import { parseLocalISODate } from '#lib/utils/date.js';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import EmptyState from '#lib/components/ui/EmptyState.svelte';
    import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
    import PaymentLinks from '#lib/components/PaymentLinks.svelte';

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
</script>

<svelte:head>
    <title>{data ? `${data.name} - Kimpay` : 'Kimpay'}</title>
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container p-4 pb-12 space-y-6">
    {#if error}
        <EmptyState
            title={error === 'not_found' ? $t('readonly.not_found.title') : $t('error.generic.title')}
            description={error === 'not_found' ? $t('readonly.not_found.desc') : $t('error.generic')}
            class="animate-pop-in mt-12"
        >
            {#snippet icon()}
                <Link class="h-12 w-12" />
            {/snippet}
        </EmptyState>
    {:else if !data}
        <ListSkeleton count={4} />
    {:else}
        <!-- Header -->
        <header class="flex items-center gap-4">
            <div class="h-14 w-14 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-3xl">
                {data.icon || DEFAULT_KIMPAY_EMOJI}
            </div>
            <div class="min-w-0 space-y-1">
                <h1 class="text-2xl font-extrabold text-gradient-brand truncate">{data.name}</h1>
                <span class="inline-flex items-center gap-1.5 rounded-full bg-muted dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    <Eye class="h-3 w-3" />
                    {$t('readonly.badge')}
                </span>
            </div>
        </header>

        <!-- Total -->
        <div class="bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-3xl border border-blue-100 dark:border-blue-900/50">
            <span class="text-[10px] text-blue-600 dark:text-blue-400 font-bold tracking-wider">{$t('balance.total_group')}</span>
            <div class="text-2xl font-black text-blue-600/90 dark:text-blue-400 mt-1 tracking-tight">{formatAmount(total, currency, $locale)}</div>
            <div class="text-xs text-muted-foreground mt-1">
                {data.expenses.length} {$t('expense.list.items')} • {data.participants.length} {$t('settings.participants').toLowerCase()}
            </div>
        </div>

        <!-- Balances -->
        <section class="space-y-3">
            <h2 class="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">{$t('readonly.balances')}</h2>
            <div class="bg-card rounded-2xl border divide-y dark:divide-slate-800">
                {#each ranked as p (p.id)}
                    {@const amount = balances[p.id] ?? 0}
                    <div class="flex items-center justify-between gap-3 p-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <Avatar name={p.name} class="h-8 w-8 shrink-0 text-xs" />
                            <span class="text-sm font-medium truncate">{p.name}</span>
                        </div>
                        <span class="text-sm font-bold tabular-nums {amount > 0.005 ? 'text-emerald-600 dark:text-emerald-400' : amount < -0.005 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}">
                            {amount > 0.005 ? '+' : ''}{formatAmount(amount, currency, $locale)}
                        </span>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Suggested payments -->
        <section class="space-y-3">
            <h2 class="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">{$t('balance.suggested.title')}</h2>
            {#if transactions.length === 0}
                <div class="flex items-center gap-3 p-4 rounded-2xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    <CircleCheck class="h-5 w-5 shrink-0" />
                    <span class="text-sm font-semibold">{$t('balance.settled.title')}</span>
                </div>
            {:else}
                <div class="space-y-2">
                    {#each transactions as tx, i (i)}
                        <div class="bg-card p-3 rounded-2xl border space-y-2">
                            <div class="flex items-center justify-between gap-2 text-sm">
                                <span class="font-semibold truncate">{nameOf(tx.from)}</span>
                                <span class="flex items-center gap-1 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 font-bold tabular-nums">
                                    {formatAmount(tx.amount, tx.currency, $locale)}
                                    <ArrowRight class="h-3 w-3 text-slate-400" />
                                </span>
                                <span class="font-semibold truncate text-right">{nameOf(tx.to)}</span>
                            </div>
                            <PaymentLinks to={byId.get(tx.to)} amount={tx.amount} currency={tx.currency} />
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

        <!-- Expenses -->
        <section class="space-y-3">
            <h2 class="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">{$t('nav.expenses')}</h2>
            {#if data.expenses.length === 0}
                <p class="text-sm text-muted-foreground pl-1">{$t('expense.list.empty.title')}</p>
            {:else}
                <div class="bg-card rounded-2xl border divide-y dark:divide-slate-800">
                    {#each data.expenses as e (e.id)}
                        <div class="flex items-center gap-3 p-3">
                            <div class="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-lg border {e.is_reimbursement ? 'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}">
                                {#if e.is_reimbursement}
                                    <HandCoins class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                {:else}
                                    {e.icon || DEFAULT_EXPENSE_EMOJI}
                                {/if}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium truncate">
                                    {e.is_reimbursement ? $t('balance.reimbursement') : e.description}
                                </div>
                                <div class="text-xs text-muted-foreground truncate">
                                    {parseLocalISODate(e.date).toLocaleDateString($locale)} •
                                    {#if e.is_reimbursement}
                                        {$t('expense.list.reimbursement', { from: nameOf(e.payer), to: nameOf(e.involved[0] ?? '') })}
                                    {:else}
                                        {e.is_income ? $t('expense.list.received_by') : $t('expense.list.paid_by')} {nameOf(e.payer)}
                                    {/if}
                                </div>
                            </div>
                            <span class="shrink-0 text-sm font-bold tabular-nums {e.is_income ? 'text-teal-700 dark:text-teal-300' : e.is_reimbursement ? 'text-emerald-700 dark:text-emerald-300' : ''}">
                                {e.is_income ? '+' : ''}{formatAmount(e.amount, e.currency, $locale)}
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

        <p class="text-center text-xs text-muted-foreground">
            {$t('readonly.footer')} <a href="/" class="font-semibold text-primary hover:underline">Kimpay</a>
        </p>
    {/if}
</div>
