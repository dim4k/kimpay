<script lang="ts">
    import type { Snippet } from 'svelte';

    let { 
        title,
        description,
        class: className = "",
        icon,
        action
    }: {
        title?: string,
        description: string,
        class?: string,
        icon?: Snippet,
        action?: Snippet
    } = $props();
</script>

<div class="flex flex-col items-center justify-center rounded-card border border-dashed bg-card/60 px-6 py-12 text-center {className}">
    {#if icon}
        <div class="mb-3 text-muted-foreground/70">
            {@render icon()}
        </div>
    {/if}
    {#if title}
        <h2 class="text-base font-semibold">{title}</h2>
    {/if}
    <p class="text-sm text-muted-foreground max-w-xs {title ? 'mt-1' : ''}">{description}</p>
    {#if action}
        <div class="mt-4">
            {@render action()}
        </div>
    {/if}
</div>
