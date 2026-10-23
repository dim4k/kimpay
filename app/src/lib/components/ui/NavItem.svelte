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
        /** `rail`: stacked in the rail of computers, the tab's key in its tooltip */
        variant?: 'bar' | 'rail';
        shortcut?: string;
    }

    let { href, icon: Icon, label, isActive, badge = false, variant = 'bar', shortcut }: Props = $props();
    let isRail = $derived(variant === 'rail');
</script>

<!-- Tabs replace each other in the history: back leaves the group. -->
<a
    {href}
    data-sveltekit-replacestate
    onclick={() => haptic('light')}
    aria-current={isActive ? 'page' : undefined}
    title={isRail && shortcut ? `${label} (${shortcut})` : undefined}
    class="group/nav flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 {isRail ? 'w-full py-1.5' : 'h-full'} {isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
>
    <span class="relative {isRail ? `flex h-8 w-14 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-primary-soft' : 'group-hover/nav:bg-muted'}` : ''}">
        <Icon class="h-6 w-6" strokeWidth={isActive ? 2.4 : 2} />
        {#if badge}
            <span class="absolute h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card {isRail ? 'right-3 top-0.5' : '-right-0.5 -top-0.5'}" aria-hidden="true"></span>
        {/if}
    </span>
    <span class="text-xs font-medium">{label}</span>
</a>
