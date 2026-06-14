<script lang="ts">
    /* eslint-disable @typescript-eslint/no-explicit-any */
    import type { ComponentType, SvelteComponent } from 'svelte';
    import { haptic } from '$lib/utils/haptic';

    interface Props {
        href: string;
        icon: ComponentType<SvelteComponent<any>>;
        label: string;
        isActive: boolean;
    }

    let { href, icon: Icon, label, isActive }: Props = $props();
</script>

<a 
    {href}
    onclick={() => haptic('light')}
    class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
>
    <div class="relative flex items-center justify-center h-9 w-12 rounded-full transition-all duration-300 {isActive ? 'bg-secondary' : ''}">
        <Icon class="h-6 w-6 transition-transform duration-300 {isActive ? 'scale-110' : ''}" strokeWidth={isActive ? 2.5 : 2} />
    </div>
    <span class="text-[10px] font-medium tracking-wide">{label}</span>
</a>
