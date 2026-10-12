<script lang="ts">
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { installStore } from '#lib/stores/install.svelte.js';
    import { fly, fade } from 'svelte/transition';
    import { Check, X, Info, AlertTriangle } from '@lucide/svelte';

    const icons = {
        success: Check,
        error: X,
        info: Info,
        warning: AlertTriangle
    };

    const colors = {
        success: 'bg-success',
        error: 'bg-destructive',
        info: 'bg-primary',
        warning: 'bg-warning'
    };
</script>

<!-- Bottom of the screen (mobile-friendly), above the tab bar or the save bar,
     and above the install banner when it shows. -->
<div
    class="pointer-events-none fixed inset-x-4 z-200 flex flex-col items-center gap-2 {installStore.bannerVisible ? 'bottom-[calc(11rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]'}"
>
    {#each $toasts as toast (toast.id)}
        {@const Icon = icons[toast.type]}
        <div
            class="pointer-events-auto flex max-w-sm items-center gap-2 rounded-card bg-foreground/90 py-2 pl-2.5 pr-4 text-sm text-background shadow-lg backdrop-blur-md"
            in:fly={{ y: 20, duration: 200 }}
            out:fade={{ duration: 150 }}
            role={toast.type === 'error' ? 'alert' : 'status'}
            data-toast
        >
            <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full {colors[toast.type]}">
                <Icon class="h-3 w-3 text-background" strokeWidth={3} />
            </div>
            <p class="font-medium">{toast.message}</p>
        </div>
    {/each}
</div>
