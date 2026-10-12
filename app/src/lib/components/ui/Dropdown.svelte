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
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3 text-sm'
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
        class={cn("flex items-center gap-1.5 rounded-control bg-muted font-medium text-foreground transition-colors hover:bg-muted/70", sizeClasses[size], triggerClass)}
    >
        {@render trigger(isOpen)}
        <ChevronDown class="h-3 w-3 text-muted-foreground transition-transform {isOpen ? 'rotate-180' : ''}" />
    </button>

    {#if isOpen}
        <div
            class="absolute top-full mt-1 z-50 min-w-[10rem] max-h-64 overflow-y-auto rounded-control border bg-popover py-1 text-popover-foreground shadow-xl {positionClasses[position]}"
            transition:slide={{ duration: 150 }}
        >
            {@render items(close)}
        </div>
    {/if}
</div>
