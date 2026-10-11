<script lang="ts" generics="T extends string">
    import { cn } from '#lib/utils/cn.js';

    interface Props {
        options: { value: T; label: string }[];
        value: T;
        /** Accessible name of the group */
        label: string;
        onchange?: (value: T) => void;
        class?: string;
    }

    let { options, value = $bindable(), label, onchange, class: className = '' }: Props = $props();

    function select(option: T) {
        if (option === value) return;
        value = option;
        onchange?.(option);
    }
</script>

<div role="radiogroup" aria-label={label} class={cn("grid gap-1 p-1 rounded-xl bg-muted dark:bg-slate-800", className)} style="grid-template-columns: repeat({options.length}, minmax(0, 1fr));">
    {#each options as option (option.value)}
        <button
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onclick={() => select(option.value)}
            class="px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors truncate {value === option.value ? 'bg-background text-primary shadow-xs dark:bg-slate-950 dark:text-indigo-300' : 'text-muted-foreground hover:text-foreground'}"
        >
            {option.label}
        </button>
    {/each}
</div>
