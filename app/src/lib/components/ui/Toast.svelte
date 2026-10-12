<script lang="ts">
    import { toasts } from '#lib/stores/toasts.svelte.js';
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

<!-- Compact toast positioned at bottom for mobile-friendly UX -->
<div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-200 flex flex-col items-center gap-2 pointer-events-none">
    {#each $toasts as toast (toast.id)}
        {@const Icon = icons[toast.type]}
        <div
            class="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground/90 px-3 py-2 text-sm text-background shadow-lg backdrop-blur-md"
            in:fly={{ y: 20, duration: 200 }}
            out:fade={{ duration: 150 }}
            role="alert"
        >
            <div class="shrink-0 w-5 h-5 rounded-full {colors[toast.type]} flex items-center justify-center">
                <Icon class="h-3 w-3 text-background" strokeWidth={3} />
            </div>
            <p class="font-medium whitespace-nowrap">{toast.message}</p>
        </div>
    {/each}
</div>

