<script lang="ts">
    import { t, locale } from '#lib/i18n.js';
    import { formatAmount } from '#lib/services/currency.js';

    interface Row {
        id: string;
        name: string;
        /** Net balance: positive = is owed money, negative = owes money */
        amount: number;
    }

    let { rows, currency }: { rows: Row[]; currency: string } = $props();

    let max = $derived(Math.max(...rows.map((r) => Math.abs(r.amount)), 0.01));

    function width(amount: number): number {
        return Math.max((Math.abs(amount) / max) * 50, 1);
    }
</script>

<!-- Diverging bars around a zero line: who advanced money, who owes it. -->
<ul class="rounded-card border bg-card p-4 space-y-3" aria-label={$t('readonly.balances')}>
    {#each rows as row (row.id)}
        {@const owed = row.amount > 0.005}
        {@const owes = row.amount < -0.005}
        <li class="grid grid-cols-[minmax(0,6rem)_1fr_auto] items-center gap-3 text-sm">
            <span class="truncate font-medium">{row.name}</span>
            <span class="relative h-2.5" aria-hidden="true">
                <span class="absolute -inset-y-1 left-1/2 w-px bg-border"></span>
                {#if owed || owes}
                    <span class="absolute inset-y-0 rounded-sm {owed ? 'left-1/2 bg-success' : 'right-1/2 bg-warning'}" style="width: {width(row.amount)}%"></span>
                {/if}
            </span>
            <span class="text-right font-semibold tabular-nums {owed ? 'text-success' : owes ? 'text-warning' : 'text-muted-foreground'}">
                {owed ? '+' : ''}{formatAmount(row.amount, currency, $locale)}
            </span>
        </li>
    {/each}
</ul>
