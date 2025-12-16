<script lang="ts">
    import type { Snippet } from 'svelte';

    let { 
        description,
        class: className = "",
        icon,
        action
    } = $props<{
        description: string,
        class?: string,
        icon?: Snippet,
        action?: Snippet
    }>();
</script>

<div class="flex flex-col items-center justify-center text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 {className}">
    {#if icon}
        <div class="mb-3 text-slate-400 dark:text-slate-500">
            {@render icon()}
        </div>
    {/if}
    <p class="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{description}</p>
    {#if action}
        <div class="mt-4">
            {@render action()}
        </div>
    {/if}
</div>
