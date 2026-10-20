<script lang="ts">
    import { ChevronDown } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { cn } from '#lib/utils/cn.js';
    import { CURRENCY_CODES, getSymbol } from '#lib/services/currency.js';
    import ChoiceSheet, { type Choice } from '#lib/components/ui/ChoiceSheet.svelte';

    /** A currency: the trigger shows it, a sheet (with a search) changes it. */
    interface Props {
        value: string;
        /** `sm` for inline toolbars, `md` next to form fields */
        size?: 'sm' | 'md';
        /** Merged into the trigger classes */
        triggerClass?: string;
        onchange?: (code: string) => void;
    }

    let {
        value = $bindable(),
        size = 'md',
        triggerClass = '',
        onchange,
    }: Props = $props();

    let isOpen = $state(false);

    // "Euro", "Dollar des États-Unis": the names in the language of the app.
    let choices = $derived.by((): Choice[] => {
        const names = new Intl.DisplayNames([$locale], { type: 'currency' });
        return CURRENCY_CODES.map((code) => ({ value: code, label: code, detail: names.of(code) ?? code, lead: getSymbol(code) }));
    });

    function select(code: string) {
        value = code;
        onchange?.(code);
    }
</script>

<button
    type="button"
    onclick={() => (isOpen = true)}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    aria-label={`${$t('currency.select_label')}: ${value}`}
    class={cn(
        "flex items-center gap-1.5 rounded-control bg-muted font-medium text-foreground transition-colors hover:bg-muted/70",
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm',
        triggerClass,
    )}
>
    {#if size === 'sm'}
        <span>{getSymbol(value)}</span>
        <span>{value}</span>
    {:else}
        <span class="text-base font-medium">{getSymbol(value)}</span>
        <span class="text-sm font-medium">{value}</span>
    {/if}
    <ChevronDown class="h-3 w-3 text-muted-foreground" />
</button>

<ChoiceSheet
    {isOpen}
    title={$t('currency.select_label')}
    {choices}
    {value}
    onselect={select}
    onClose={() => (isOpen = false)}
    searchPlaceholder={$t('currency.search_placeholder')}
    noResult={(query) => $t('currency.no_result', { query })}
/>
