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

<div class="fixed top-20 left-4 right-4 z-[200] flex flex-col items-center gap-2 pointer-events-none">
    {#each $toasts as toast (toast.id)}
        <div
            class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-md bg-slate-900/90 dark:bg-slate-800/95 text-white max-w-sm w-full border border-slate-700/50"
            in:fly={{ y: -50, duration: 300 }}
            out:fade={{ duration: 200 }}
            role="alert"
        >
            <div class="flex-shrink-0 w-8 h-8 rounded-full {colors[toast.type]} flex items-center justify-center">
                <svelte:component this={icons[toast.type]} class="w-4 h-4 text-white" strokeWidth={3} />
            </div>
            <p class="flex-1 text-sm font-medium">{toast.message}</p>
            <button 
                onclick={() => toasts.remove(toast.id)}
                class="flex-shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
            >
                <X class="w-4 h-4 text-slate-400" />
            </button>
        </div>
    {/each}
</div>
