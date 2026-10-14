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
        /**
         * The choices, each a `<button role="option" aria-selected tabindex="-1">`
         * (see Option keys below) - receives the close function
         */
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
    let triggerEl = $state<HTMLButtonElement>();

    /** A choice made (or Escape): back to the trigger. A click elsewhere leaves the focus there. */
    function close(restoreFocus = true) {
        isOpen = false;
        if (restoreFocus) triggerEl?.focus();
    }

    function options(list: HTMLElement): HTMLElement[] {
        return [...list.querySelectorAll<HTMLElement>('[role="option"]')];
    }

    // Opened: on the current choice, so the arrows start from it.
    function focusSelected(list: HTMLElement) {
        const all = options(list);
        (all.find((o) => o.getAttribute('aria-selected') === 'true') ?? all[0])?.focus();
    }

    // Option keys: arrows, Home / End, Escape.
    function navigate(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            // Only the menu closes, not the sheet it may be in.
            e.preventDefault();
            e.stopPropagation();
            close();
            return;
        }
        if (e.key === 'Tab') {
            close(false);
            return;
        }
        const all = options(e.currentTarget as HTMLElement);
        const i = all.indexOf(document.activeElement as HTMLElement);
        const next = ({ ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 } as Record<string, number>)[e.key];
        if (next === undefined) return;
        e.preventDefault();
        all[(next + all.length) % all.length]?.focus();
    }

    function onTriggerKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            isOpen = true;
        }
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

<div class="relative {className}" {@attach isOpen && dismissable(() => close(false))}>
    <button
        bind:this={triggerEl}
        type="button"
        onclick={() => (isOpen = !isOpen)}
        onkeydown={onTriggerKeydown}
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
            role="listbox"
            aria-label={label}
            tabindex="-1"
            onkeydown={navigate}
            {@attach focusSelected}
            class="absolute top-full mt-1 z-50 min-w-[10rem] max-h-64 overflow-y-auto rounded-control border bg-popover py-1 text-popover-foreground shadow-xl {positionClasses[position]}"
            transition:slide={{ duration: 150 }}
        >
            {@render items(close)}
        </div>
    {/if}
</div>
