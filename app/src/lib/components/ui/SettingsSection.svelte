<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import type { LucideProps } from '@lucide/svelte';
    import { cn } from '#lib/utils/cn.js';

    interface Props {
        title: string;
        icon?: Component<LucideProps>;
        class?: string;
        children: Snippet;
    }

    let { title, icon: Icon, class: className = '', children }: Props = $props();
</script>

<section class={cn("bg-card p-6 rounded-xl border shadow-xs space-y-6 transition-colors animate-pop-in", className)}>
    <h2 class="font-semibold text-lg border-b dark:border-slate-800 pb-2 dark:text-slate-100 flex items-center gap-2">
        {#if Icon}<Icon class="h-4 w-4" />{/if}
        {title}
    </h2>
    {@render children()}
</section>
