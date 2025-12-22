<script lang="ts">
    import { ChevronDown } from "lucide-svelte";
    import { slide } from 'svelte/transition';

    type Position = 'bottom-right' | 'bottom-left';
    type DropdownSize = 'sm' | 'md';

    interface Props {
        /** Position of the dropdown menu */
        position?: Position;
        /** Size variant */
        size?: DropdownSize;
        /** Trigger button content - receives isOpen state */
        trigger: import('svelte').Snippet<[boolean]>;
        /** Dropdown menu content - receives close function */
        items: import('svelte').Snippet<[() => void]>;
        /** Optional class for the container */
        class?: string;
        /** Optional class for the trigger button */
        triggerClass?: string;
    }

    let { 
        position = 'bottom-right',
        size = 'md',
        trigger,
        items,
        class: className = '',
        triggerClass = ''
    }: Props = $props();

    let isOpen = $state(false);

    function close() {
        isOpen = false;
    }

    function toggle() {
        isOpen = !isOpen;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            close();
        }
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

<div class="relative {className}">
    <button
        type="button"
        onclick={toggle}
        onkeydown={handleKeydown}
        class="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium {sizeClasses[size]} {triggerClass}"
    >
        {@render trigger(isOpen)}
        <ChevronDown class="h-3 w-3 text-slate-400 transition-transform {isOpen ? 'rotate-180' : ''}" />
    </button>

    {#if isOpen}
        <div 
            class="absolute top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 min-w-[120px] max-h-48 overflow-y-auto {positionClasses[position]}" 
            transition:slide={{ duration: 150 }}
        >
            {@render items(close)}
        </div>
        <!-- Backdrop to close on outside click -->
        <div 
            class="fixed inset-0 z-40" 
            onclick={close} 
            role="button" 
            tabindex="-1" 
            onkeydown={handleKeydown}
        ></div>
    {/if}
</div>
