<script lang="ts">
    import { toasts } from '$lib/stores/toasts.svelte';
    import { fly, fade } from 'svelte/transition';
    import { Check, X, Info, AlertTriangle } from 'lucide-svelte';

    const icons = {
        success: Check,
        error: X,
        info: Info,
        warning: AlertTriangle
    };

    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-amber-500'
    };
</script>

<!-- Compact toast positioned at bottom for mobile-friendly UX -->
<div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
    {#each $toasts as toast (toast.id)}
        <div
            class="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-md bg-slate-900/80 dark:bg-slate-800/90 text-white text-sm"
            in:fly={{ y: 20, duration: 200 }}
            out:fade={{ duration: 150 }}
            role="alert"
        >
            <div class="flex-shrink-0 w-5 h-5 rounded-full {colors[toast.type]} flex items-center justify-center">
                <svelte:component this={icons[toast.type]} class="w-3 h-3 text-white" strokeWidth={3} />
            </div>
            <p class="font-medium whitespace-nowrap">{toast.message}</p>
        </div>
    {/each}
</div>

