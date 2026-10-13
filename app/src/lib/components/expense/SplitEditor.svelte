<script lang="ts">
    import type { Participant, SplitMode } from '#lib/types.js';
    import { t, locale } from '#lib/i18n.js';
    import { formatAmount } from '#lib/services/currency.js';
    import { checkSplit, defaultSplitValues, distribute, fromMinor, splitWeights, toMinor } from '#lib/split.js';
    import { formatDecimal, parseDecimal, sanitizeDecimal } from '#lib/utils/amount.js';
    import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';

    interface Props {
        /** Participants involved in the expense */
        involved: Participant[];
        mode: SplitMode;
        /** participant ID -> shares / amount / percent, depending on `mode` */
        values: Record<string, number>;
        amount: number;
        currency: string;
        /** Shares each member counts for by default (1 when missing) */
        weights?: Record<string, number>;
    }

    let { involved, mode = $bindable(), values = $bindable(), amount, currency, weights = {} }: Props = $props();

    let ids = $derived(involved.map((p) => p.id));

    const modes: { value: SplitMode; key: 'expense.split.equal' | 'expense.split.shares' | 'expense.split.amounts' | 'expense.split.percent' }[] = [
        { value: 'equal', key: 'expense.split.equal' },
        { value: 'shares', key: 'expense.split.shares' },
        { value: 'amounts', key: 'expense.split.amounts' },
        { value: 'percent', key: 'expense.split.percent' },
    ];

    // What is typed in each field ("12," while typing), until the values
    // are set from outside (another mode, a remainder given).
    let texts = $state<Record<string, string>>({});

    function changeMode(next: SplitMode) {
        values = defaultSplitValues(next, ids, amount, currency, weights);
        texts = {};
    }

    function type(id: string, e: Event) {
        const el = e.currentTarget as HTMLInputElement;
        const clean = sanitizeDecimal(el.value, mode === 'percent' ? 3 : 8);
        if (clean !== el.value) el.value = clean;
        texts[id] = clean;
        values = { ...values, [id]: parseDecimal(clean) };
    }

    // Someone added to the expense gets their shares by default (one, unless set).
    $effect(() => {
        if (mode !== 'shares') return;
        const missing = ids.filter((id) => values[id] === undefined);
        if (missing.length) values = { ...values, ...Object.fromEntries(missing.map((id) => [id, weights[id] ?? 1])) };
    });

    let check = $derived(checkSplit(mode, values, ids, amount, currency));

    // What each person pays, for the modes where it is not typed directly.
    let preview = $derived.by(() => {
        if (mode === 'amounts' || !(amount > 0)) return {};
        const minor = distribute(toMinor(amount, currency), splitWeights({ involved: ids, split: { mode, values } }, ids));
        return Object.fromEntries(Object.entries(minor).map(([id, v]) => [id, fromMinor(v, currency)]));
    });

    // Amounts or percents left (or over): one tap gives them to someone.
    let rest = $derived((mode === 'amounts' || mode === 'percent') && check.remaining !== 0 ? check.remaining : null);

    function restLabel(value: number): string {
        const sign = value > 0 ? '+' : '−';
        return mode === 'percent'
            ? `${sign}${formatDecimal(Math.abs(value), $locale)} %`
            : `${sign}${formatAmount(Math.abs(value), currency, $locale)}`;
    }

    function giveRest(id: string) {
        if (rest === null) return;
        const next = Math.round(((values[id] ?? 0) + rest) * 100) / 100;
        values = { ...values, [id]: next };
        texts = { ...texts, [id]: formatDecimal(next, $locale) };
    }
</script>

<div class="space-y-2">
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
                    {#if rest !== null && (values[p.id] ?? 0) + rest >= 0}
                        <button
                            type="button"
                            onclick={() => giveRest(p.id)}
                            class="h-9 shrink-0 rounded-full border border-dashed border-primary/50 px-2.5 text-xs font-semibold tabular-nums text-primary transition-colors hover:bg-primary-soft"
                            aria-label={$t('expense.split.give_rest', { name: p.name })}
                            title={$t('expense.split.give_rest', { name: p.name })}
                        >
                            {restLabel(rest)}
                        </button>
                    {:else if mode !== 'amounts'}
                        <span class="text-sm text-muted-foreground tabular-nums">
                            {preview[p.id] !== undefined ? formatAmount(preview[p.id]!, currency, $locale) : '–'}
                        </span>
                    {/if}
                    <div class="relative w-28 shrink-0">
                        <input
                            type="text"
                            inputmode="decimal"
                            autocomplete="off"
                            value={texts[p.id] ?? formatDecimal(values[p.id], $locale)}
                            oninput={(e) => type(p.id, e)}
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
