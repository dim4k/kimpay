<script lang="ts">
    import { Check } from '@lucide/svelte';
    import { t } from '#lib/i18n.js';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import PaymentLinks from '#lib/components/PaymentLinks.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import type { Participant } from '#lib/types.js';

    /**
     * A debt of mine, or owed to me: the same card in the Balance tab and on
     * a member's sheet. Orange when I owe, green when I am owed (the money
     * colors of the app), with the links to pay and the button to record it.
     */
    let {
        other,
        iOwe,
        amount,
        payAmount,
        payCurrency,
        onSettle,
        onpay,
    }: {
        /** The other member of the debt */
        other: Participant | undefined;
        iOwe: boolean;
        /** Formatted, in the currency shown */
        amount: string;
        /** What the payment links ask for (the debt's own currency) */
        payAmount: number;
        payCurrency: string;
        onSettle: () => void;
        /** A payment link was opened */
        onpay?: (service: string) => void;
    } = $props();

    let name = $derived(other?.name ?? $t('common.unknown'));
</script>

<div class="space-y-3 rounded-card p-4 {iOwe ? 'bg-warning-soft' : 'bg-success-soft'}" data-testid="debt-card">
    <div class="flex items-center gap-3">
        <Avatar {name} record={other} class="h-9 w-9 shrink-0 text-xs" />
        <p class="min-w-0 flex-1 text-base font-semibold">
            {iOwe ? $t('debt.you_owe', { name }) : $t('debt.owes_you', { name })}
        </p>
        <span class="shrink-0 text-lg font-bold tabular-nums {iOwe ? 'text-warning' : 'text-success'}">{amount}</span>
    </div>
    <div class="flex flex-wrap gap-2">
        {#if iOwe}
            <PaymentLinks to={other} amount={payAmount} currency={payCurrency} {onpay} />
        {/if}
        <Button size="sm" variant="outline" onclick={onSettle}>
            <Check />
            {$t('balance.mark_settled')}
        </Button>
    </div>
</div>
