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

<div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
    <Icon class="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
    <div class="text-sm">
        <span class="font-bold text-slate-800 dark:text-slate-200 block">{title}</span>
        <span class="text-slate-500 dark:text-slate-400">{description}</span>
    </div>
</div>
