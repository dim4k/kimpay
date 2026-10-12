<script lang="ts">
    import type { Component } from 'svelte';
    import type { LucideProps } from '@lucide/svelte';

    /** An explanatory bullet (icon, title, text) in help modals. */
    let { icon: Icon, title, description }: {
        icon: Component<LucideProps>;
        title: string;
        description: string;
    } = $props();
</script>

<div class="flex items-start gap-3 rounded-control bg-muted p-3">
    <Icon class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
    <div class="text-sm">
        <span class="block font-semibold">{title}</span>
        <span class="text-muted-foreground">{description}</span>
    </div>
</div>
