<script lang="ts">
    import { ArrowRight } from '@lucide/svelte';
    import { t } from '#lib/i18n.js';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import type { Participant } from '#lib/types.js';

    /**
     * "Léa → Tom  €25.00": a payment between two members, on one line of a
     * list (the app's Balance tab and the read-only link).
     */
    let {
        from,
        to,
        amount,
    }: {
        /** The name shown ("You" for me) and the member, for the avatar */
        from: { name: string; record?: Participant | undefined };
        to: { name: string; record?: Participant | undefined };
        /** Formatted */
        amount: string;
    } = $props();
</script>

<span class="flex shrink-0" aria-hidden="true">
    <Avatar name={from.record?.name ?? from.name} record={from.record} class="h-8 w-8 text-xs ring-2 ring-card" />
    <Avatar name={to.record?.name ?? to.name} record={to.record} class="-ml-2 h-8 w-8 text-xs ring-2 ring-card" />
</span>
<span class="flex min-w-0 flex-1 items-center gap-1.5 text-base font-medium">
    <span class="truncate">{from.name}</span>
    <ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" aria-label={$t('balance.pays')} />
    <span class="truncate">{to.name}</span>
</span>
<span class="shrink-0 text-base font-semibold tabular-nums">{amount}</span>
