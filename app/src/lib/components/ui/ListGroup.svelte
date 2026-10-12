<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '#lib/utils/cn.js';

    /**
     * One surface holding rows separated by hairlines (settings, participants,
     * expenses...). Not clipped, so popovers inside rows can overflow it:
     * rows round their own first/last corners (see ListRow).
     */
    let { class: className = '', label, children }: { class?: string; label?: string; children: Snippet } = $props();
</script>

<div class={cn('rounded-card border bg-card divide-y divide-border', className)} role={label ? 'group' : undefined} aria-label={label}>
    {@render children()}
</div>
