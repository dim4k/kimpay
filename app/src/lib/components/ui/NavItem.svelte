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
        /** A short value on the icon instead (a balance) */
        tag?: string | undefined;
        tagTone?: 'success' | 'warning' | undefined;
    }

    let { href, icon: Icon, label, isActive, badge = false, tag, tagTone = 'success' }: Props = $props();
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
        {#if tag}
            <span
                class="absolute -top-1.5 left-3.5 whitespace-nowrap rounded-full px-1.5 text-[0.625rem] font-bold leading-4 tabular-nums ring-2 ring-card {tagTone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}"
                data-testid="nav-tag"
            >{tag}</span>
        {:else if badge}
            <span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" aria-hidden="true"></span>
        {/if}
    </span>
    <span class="text-xs font-medium">{label}</span>
</a>
