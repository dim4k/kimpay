<script lang="ts">
    import type { Component } from 'svelte';
    import type { LucideProps } from '@lucide/svelte';
    import { haptic } from '#lib/utils/haptic.js';

    interface Props {
        href: string;
        icon: Component<LucideProps>;
        label: string;
        isActive: boolean;
    }

    let { href, icon: Icon, label, isActive }: Props = $props();
</script>

<a
    {href}
    onclick={() => haptic('light')}
    aria-current={isActive ? 'page' : undefined}
    class="flex h-full flex-col items-center justify-center gap-0.5 transition-colors duration-150 {isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
>
    <Icon class="h-6 w-6" strokeWidth={isActive ? 2.4 : 2} />
    <span class="text-xs font-medium">{label}</span>
</a>
