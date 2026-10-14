<script lang="ts">
    import { Check } from "@lucide/svelte";
    import { t } from '#lib/i18n.js';
    import Dropdown from '#lib/components/ui/Dropdown.svelte';
    import { CURRENCY_CODES, getSymbol } from '#lib/services/currency.js';

    interface Props {
        value: string;
        /** `sm` for inline toolbars, `md` next to form fields */
        size?: 'sm' | 'md';
        position?: 'bottom-right' | 'bottom-left';
        /** Merged into the trigger classes */
        triggerClass?: string;
        onchange?: (code: string) => void;
    }

    let {
        value = $bindable(),
        size = 'md',
        position = 'bottom-right',
        triggerClass = '',
        onchange,
    }: Props = $props();

    function select(code: string, close: () => void) {
        value = code;
        onchange?.(code);
        close();
    }
</script>

<Dropdown {size} {position} {triggerClass} label={$t('currency.select_label')}>
    {#snippet trigger()}
        {#if size === 'sm'}
            <span>{getSymbol(value)}</span>
            <span>{value}</span>
        {:else}
            <span class="text-base font-medium">{getSymbol(value)}</span>
            <span class="text-sm font-medium">{value}</span>
        {/if}
    {/snippet}
    {#snippet items(close)}
        {#each CURRENCY_CODES as code (code)}
            <button
                type="button"
                role="option"
                aria-selected={value === code}
                tabindex="-1"
                onclick={() => select(code, close)}
                class="flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-muted focus-ring-inset {value === code ? 'bg-primary-soft' : ''}"
            >
                <div class="flex items-center gap-2">
                    <span class="text-base w-5 text-center">{getSymbol(code)}</span>
                    <span class="font-medium">{code}</span>
                </div>
                {#if value === code}
                    <Check class="h-4 w-4 text-primary" />
                {/if}
            </button>
        {/each}
    {/snippet}
</Dropdown>
