<script lang="ts">
    import type { Component } from 'svelte';
    import type { LucideProps } from '@lucide/svelte';
    import { haptic } from '#lib/utils/haptic.js';

    interface Props {
        href: string;
        icon: Component<LucideProps>;
        label: string;
        isActive: boolean;
        /** A dot on the icon: something to do there */
        badge?: boolean;
    }

    let { href, icon: Icon, label, isActive, badge = false }: Props = $props();
</script>

<!-- Tabs replace each other in the history: back leaves the group. -->
<a
    {href}
    data-sveltekit-replacestate
    onclick={() => haptic('light')}
    aria-current={isActive ? 'page' : undefined}
    class="flex h-full flex-col items-center justify-center gap-0.5 transition-colors duration-150 {isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
>
    <span class="relative">
        <Icon class="h-6 w-6" strokeWidth={isActive ? 2.4 : 2} />
        {#if badge}
            <span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" aria-hidden="true"></span>
        {/if}
    </span>
    <span class="text-xs font-medium">{label}</span>
</a>
