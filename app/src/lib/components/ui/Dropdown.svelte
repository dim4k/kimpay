<script lang="ts">
    import type { Snippet } from 'svelte';
    import { ChevronDown } from "@lucide/svelte";
    import { slide } from 'svelte/transition';
    import { cn } from '#lib/utils/cn.js';
    import { dismissable } from '#lib/attachments/dismissable.js';

    type Position = 'bottom-right' | 'bottom-left';
    type DropdownSize = 'sm' | 'md';

    interface Props {
        /** Position of the dropdown menu */
        position?: Position;
        /** Size variant */
        size?: DropdownSize;
        /** Trigger button content - receives isOpen state */
        trigger: Snippet<[boolean]>;
        /** Dropdown menu content - receives close function */
        items: Snippet<[() => void]>;
        /** Optional class for the container */
        class?: string;
        /** Optional class for the trigger button (merged, so it can override defaults) */
        triggerClass?: string;
        /** Accessible label of the trigger */
        label?: string;
    }

    let {
        position = 'bottom-right',
        size = 'md',
        trigger,
        items,
        class: className = '',
        triggerClass = '',
        label
    }: Props = $props();

    let isOpen = $state(false);

    function close() {
        isOpen = false;
    }

    const sizeClasses = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-3 py-1.5'
    };

    const positionClasses = {
        'bottom-right': 'right-0',
        'bottom-left': 'left-0'
    };
</script>

<div class="relative {className}" {@attach isOpen && dismissable(close)}>
    <button
        type="button"
        onclick={() => (isOpen = !isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label}
        class={cn("flex items-center gap-1.5 rounded-lg bg-muted hover:bg-muted/70 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors font-medium", sizeClasses[size], triggerClass)}
    >
        {@render trigger(isOpen)}
        <ChevronDown class="h-3 w-3 text-muted-foreground transition-transform {isOpen ? 'rotate-180' : ''}" />
    </button>

    {#if isOpen}
        <div
            class="absolute top-full mt-1 z-50 bg-popover text-popover-foreground rounded-lg shadow-xl border min-w-[120px] max-h-48 overflow-y-auto {positionClasses[position]}"
            transition:slide={{ duration: 150 }}
        >
            {@render items(close)}
        </div>
    {/if}
</div>
