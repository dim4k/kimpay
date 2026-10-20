<script lang="ts" generics="T extends string">
    import { cn } from '#lib/utils/cn.js';

    interface Props {
        options: { value: T; label: string }[];
        value: T;
        /** Accessible name of the group */
        label: string;
        onchange?: (value: T) => void;
        /** Each option at least as wide as its label (long labels), the rest shared */
        fit?: boolean;
        class?: string;
    }

    let { options, value = $bindable(), label, onchange, fit = false, class: className = '' }: Props = $props();

    function select(option: T) {
        if (option === value) return;
        value = option;
        onchange?.(option);
    }

    // A radio group: one Tab stop (the choice), the arrows change it.
    function onkeydown(e: KeyboardEvent) {
        const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
        if (!step) return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const next = options[(i + step + options.length) % options.length]!;
        select(next.value);
        (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
    }
</script>

<div role="radiogroup" aria-label={label} tabindex="-1" {onkeydown} class={cn("grid gap-1 rounded-full bg-muted p-1", className)} style="grid-template-columns: repeat({options.length}, minmax({fit ? 'max-content' : '0'}, 1fr));">
    {#each options as option (option.value)}
        <button
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={value === option.value}
            tabindex={value === option.value ? 0 : -1}
            onclick={() => select(option.value)}
            class="h-9 truncate rounded-full px-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring {value === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
        >
            {option.label}
        </button>
    {/each}
</div>
