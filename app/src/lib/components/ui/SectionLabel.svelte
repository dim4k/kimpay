<script lang="ts">
    import type { Snippet } from 'svelte';

    /** Heading of a group of content (sentence case, never shouted). */
    let { title, id, actions }: { title: string; id?: string; actions?: Snippet | undefined } = $props();
</script>

<div class="flex min-h-9 items-center justify-between gap-3 px-1">
    <h2 {id} class="text-sm font-semibold text-muted-foreground">{title}</h2>
    {#if actions}
        <div class="shrink-0">{@render actions()}</div>
    {/if}
</div>
