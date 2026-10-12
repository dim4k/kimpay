<script lang="ts">
    import type { Snippet } from 'svelte';
    import CountUp from './CountUp.svelte';

    type Tone = 'success' | 'warning' | 'neutral';

    interface Props {
        label: string;
        /** Amount shown big (absolute value); omit for a text-only state */
        amount?: number | undefined;
        currency?: string;
        /** Shown big instead of an amount (e.g. "All settled up!") */
        text?: string;
        tone?: Tone;
        /** Meta line below the amount (details, then an action) */
        children?: Snippet;
    }

    let { label, amount, currency = 'EUR', text, tone = 'neutral', children }: Props = $props();

    const surfaces: Record<Tone, string> = {
        success: 'bg-success-soft',
        warning: 'bg-warning-soft',
        neutral: 'bg-card border',
    };
    const inks: Record<Tone, string> = {
        success: 'text-success',
        warning: 'text-warning',
        neutral: 'text-foreground',
    };
</script>

<section class="rounded-card p-4 space-y-3 animate-pop-in {surfaces[tone]}">
    <div class="space-y-1">
        <p class="text-sm font-medium text-foreground/70">{label}</p>
        <p class="text-display font-bold tracking-tight tabular-nums {inks[tone]}">
            {#if amount !== undefined}
                <CountUp value={Math.abs(amount)} {currency} />
            {:else}
                {text}
            {/if}
        </p>
    </div>
    {#if children}
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm text-foreground/70">
            {@render children()}
        </div>
    {/if}
</section>
