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
    class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
>
    <div class="relative">
        <Icon class="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
        {#if isActive}
            <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
        {/if}
    </div>
    <span class="text-[10px] font-medium tracking-wide">{label}</span>
</a>
