<script lang="ts">
    import type { Snippet } from 'svelte';

    /**
     * The buttons closing a dialog, side by side and of equal width: the
     * secondary action first, the main one last (under the thumb).
     */
    let { children }: { children: Snippet } = $props();
</script>

<div class="grid auto-cols-fr grid-flow-col gap-3">
    {@render children()}
</div>
