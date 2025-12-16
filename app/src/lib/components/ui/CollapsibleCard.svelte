<script lang="ts">
    import { ChevronDown } from 'lucide-svelte';
    import { slide } from 'svelte/transition';

    import type { Snippet } from 'svelte';

    let { 
        title, 
        isOpen = $bindable(false),
        class: className = "",
        icon,
        children
    } = $props<{
        title: string,
        isOpen?: boolean,
        class?: string,
        icon?: Snippet,
        children?: Snippet
    }>();
</script>

<div class="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm transition-colors hover:border-border/80 {className}">
    <button 
        onclick={() => isOpen = !isOpen}
        class="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors group"
        aria-expanded={isOpen}
    >
        <div class="flex items-center gap-3">
            {#if icon}
                 {@render icon()}
            {/if}
            <div class="text-left">
                <h2 class="font-semibold text-sm text-foreground">{title}</h2>
            </div>
        </div>
        <ChevronDown class="h-5 w-5 text-muted-foreground transition-transform duration-300 {isOpen ? 'rotate-180' : ''}" />
    </button>

    {#if isOpen}
        <div transition:slide>
            <div class="border-t border-border/50 mx-4"></div>
            <div class="p-4 pt-4">
                {@render children?.()}
            </div>
        </div>
    {/if}
</div>
