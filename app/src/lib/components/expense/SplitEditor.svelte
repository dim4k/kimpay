<script lang="ts">
    import type { Participant, SplitMode } from '#lib/types.js';
    import { t, locale } from '#lib/i18n.js';
    import { formatAmount } from '#lib/services/currency.js';
    import { checkSplit, defaultSplitValues, distribute, fromMinor, splitWeights, toMinor } from '#lib/split.js';
    import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';

    interface Props {
        /** Participants involved in the expense */
        involved: Participant[];
        mode: SplitMode;
        /** participant ID -> shares / amount / percent, depending on `mode` */
        values: Record<string, number>;
        amount: number;
        currency: string;
    }

    let { involved, mode = $bindable(), values = $bindable(), amount, currency }: Props = $props();

    let ids = $derived(involved.map((p) => p.id));

    const modes: { value: SplitMode; key: 'expense.split.equal' | 'expense.split.shares' | 'expense.split.amounts' | 'expense.split.percent' }[] = [
        { value: 'equal', key: 'expense.split.equal' },
        { value: 'shares', key: 'expense.split.shares' },
        { value: 'amounts', key: 'expense.split.amounts' },
        { value: 'percent', key: 'expense.split.percent' },
    ];

    function changeMode(next: SplitMode) {
        values = defaultSplitValues(next, ids, amount, currency);
    }

    // Someone added to the expense gets one share by default.
    $effect(() => {
        if (mode !== 'shares') return;
        const missing = ids.filter((id) => values[id] === undefined);
        if (missing.length) values = { ...values, ...Object.fromEntries(missing.map((id) => [id, 1])) };
    });

    let check = $derived(checkSplit(mode, values, ids, amount, currency));

    // What each person pays, for the modes where it is not typed directly.
    let preview = $derived.by(() => {
        if (mode === 'amounts' || !(amount > 0)) return {};
        const minor = distribute(toMinor(amount, currency), splitWeights({ involved: ids, split: { mode, values } }, ids));
        return Object.fromEntries(Object.entries(minor).map(([id, v]) => [id, fromMinor(v, currency)]));
    });
</script>

<div class="space-y-2">
    <span class="block text-sm font-semibold text-muted-foreground">{$t('expense.split.label')}</span>
    <SegmentedControl
        options={modes.map((m) => ({ value: m.value, label: $t(m.key) }))}
        bind:value={mode}
        label={$t('expense.split.label')}
        onchange={changeMode}
    />

    {#if mode !== 'equal'}
        <div class="space-y-2 pt-1">
            {#each involved as p (p.id)}
                <div class="flex items-center gap-3">
                    <span class="flex-1 min-w-0 truncate text-sm font-medium">{p.name}</span>
                    {#if mode !== 'amounts'}
                        <span class="text-sm text-muted-foreground tabular-nums">
                            {preview[p.id] !== undefined ? formatAmount(preview[p.id]!, currency, $locale) : '–'}
                        </span>
                    {/if}
                    <div class="relative w-28 shrink-0">
                        <input
                            type="number"
                            inputmode="decimal"
                            min="0"
                            step={mode === 'shares' ? '1' : '0.01'}
                            bind:value={values[p.id]}
                            aria-label={$t('expense.split.value_for', { name: p.name })}
                            class="h-11 w-full rounded-control border border-input bg-card pl-3 pr-8 text-right text-base tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {mode === 'percent' ? '%' : mode === 'shares' ? '×' : ''}
                        </span>
                    </div>
                </div>
            {/each}
        </div>

        {#if mode === 'amounts' && check.remaining !== 0}
            <p class="text-sm font-medium text-destructive">
                {check.remaining > 0
                    ? $t('expense.split.amount_left', { amount: formatAmount(check.remaining, currency, $locale) })
                    : $t('expense.split.amount_over', { amount: formatAmount(-check.remaining, currency, $locale) })}
            </p>
        {:else if mode === 'percent' && check.remaining !== 0}
            <p class="text-sm font-medium text-destructive">
                {check.remaining > 0
                    ? $t('expense.split.percent_left', { percent: String(check.remaining) })
                    : $t('expense.split.percent_over', { percent: String(-check.remaining) })}
            </p>
        {:else if mode === 'shares' && !check.valid}
            <p class="text-sm font-medium text-destructive">{$t('expense.split.shares_invalid')}</p>
        {/if}
    {/if}
</div>
