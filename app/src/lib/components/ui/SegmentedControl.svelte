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

<div role="radiogroup" aria-label={label} class={cn("grid gap-1 rounded-full bg-muted p-1", className)} style="grid-template-columns: repeat({options.length}, minmax(0, 1fr));">
    {#each options as option (option.value)}
        <button
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onclick={() => select(option.value)}
            class="h-9 truncate rounded-full px-3 text-sm font-semibold transition-colors duration-150 {value === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
        >
            {option.label}
        </button>
    {/each}
</div>
