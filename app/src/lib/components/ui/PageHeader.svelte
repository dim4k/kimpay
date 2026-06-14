<script lang="ts">
    import type { Snippet } from 'svelte';

    let {
        title,
        subtitle,
        actions
    } = $props<{
        title: string;
        subtitle?: string;
        actions?: Snippet;
    }>();
</script>

<header class="flex items-start justify-between gap-3">
    <div class="space-y-1 min-w-0">
        <h1 class="text-2xl font-extrabold text-gradient-brand w-fit">{title}</h1>
        {#if subtitle}
            <p class="text-muted-foreground font-medium text-sm">{subtitle}</p>
        {/if}
    </div>
    {#if actions}
        <div class="shrink-0">
            {@render actions()}
        </div>
    {/if}
</header>
