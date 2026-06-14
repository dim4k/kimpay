<script lang="ts">
    import type { Snippet } from 'svelte';

    let { 
        title,
        description,
        class: className = "",
        icon,
        action
    } = $props<{
        title?: string,
        description: string,
        class?: string,
        icon?: Snippet,
        action?: Snippet
    }>();
</script>

<div class="flex flex-col items-center justify-center text-center py-12 bg-muted/40 dark:bg-slate-900/50 rounded-3xl border border-dashed border-border {className}">
    {#if icon}
        <div class="mb-3 text-muted-foreground/60">
            {@render icon()}
        </div>
    {/if}
    {#if title}
        <p class="font-medium text-foreground/80">{title}</p>
    {/if}
    <p class="text-sm text-muted-foreground max-w-xs {title ? 'mt-1' : ''}">{description}</p>
    {#if action}
        <div class="mt-4">
            {@render action()}
        </div>
    {/if}
</div>
