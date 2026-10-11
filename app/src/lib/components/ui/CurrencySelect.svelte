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
            <span class="text-xs">{getSymbol(value)}</span>
            <span class="text-xs">{value}</span>
        {:else}
            <span class="text-base font-medium">{getSymbol(value)}</span>
            <span class="font-medium text-sm text-slate-700 dark:text-slate-200">{value}</span>
        {/if}
    {/snippet}
    {#snippet items(close)}
        {#each CURRENCY_CODES as code (code)}
            <button
                type="button"
                onclick={() => select(code, close)}
                class="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm {value === code ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}"
            >
                <div class="flex items-center gap-2">
                    <span class="text-base w-5 text-center">{getSymbol(code)}</span>
                    <span class="font-medium text-slate-900 dark:text-slate-100">{code}</span>
                </div>
                {#if value === code}
                    <Check class="h-3.5 w-3.5 text-indigo-500" />
                {/if}
            </button>
        {/each}
    {/snippet}
</Dropdown>
