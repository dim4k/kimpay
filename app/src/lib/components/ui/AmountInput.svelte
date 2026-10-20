<script lang="ts">
    import type { Snippet } from 'svelte';
    import { locale } from '#lib/i18n.js';
    import { sanitizeDecimal } from '#lib/utils/amount.js';

    /**
     * The amount of the app, the same wherever money is typed (an expense, a
     * reimbursement): big and centered, the decimal keyboard, "," or "." as
     * separator, and its currency underneath.
     */
    let {
        id,
        label,
        value = $bindable(''),
        ref = $bindable(null),
        invalid = false,
        highlighted = false,
        describedby,
        oninput,
        onenter,
        below,
    }: {
        id: string;
        /** Read out (the sheet around it says it already) */
        label: string;
        /** As typed: digits and one separator */
        value?: string;
        ref?: HTMLInputElement | null;
        /** Shown in red (e.g. more than the amount due) */
        invalid?: boolean;
        /** Filled by a receipt scan: ringed until edited */
        highlighted?: boolean;
        describedby?: string | undefined;
        /** Typed into (after cleaning) */
        oninput?: () => void;
        /** Enter pressed */
        onenter?: () => void;
        /** Under the amount: its currency, badges */
        below?: Snippet;
    } = $props();

    // "0.00" or "0,00": the decimal separator of the language.
    let placeholder = $derived((0).toLocaleString($locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    /** Digits and one decimal separator, at most 8 digits and 2 decimals. */
    function sanitize(e: Event) {
        const el = e.currentTarget as HTMLInputElement;
        const clean = sanitizeDecimal(el.value);
        if (clean !== el.value) el.value = clean;
        value = clean;
        oninput?.();
    }
</script>

<div class="space-y-2 text-center">
    <label for={id} class="sr-only">{label}</label>
    <input
        {id}
        bind:this={ref}
        type="text"
        inputmode="decimal"
        autocomplete="off"
        {value}
        oninput={sanitize}
        onkeydown={(e) => e.key === 'Enter' && onenter?.()}
        {placeholder}
        aria-invalid={invalid}
        aria-describedby={describedby}
        class="w-full rounded-card bg-transparent text-center text-5xl font-bold tracking-tight tabular-nums outline-hidden transition-shadow placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/40 {highlighted ? 'ring-2 ring-primary/40' : ''} {invalid ? 'text-destructive' : ''}"
    />
    {#if below}
        <div class="flex items-center justify-center gap-2">
            {@render below()}
        </div>
    {/if}
</div>
