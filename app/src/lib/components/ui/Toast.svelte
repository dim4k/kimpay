<script lang="ts">
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { installStore } from '#lib/stores/install.svelte.js';
    import { t } from '#lib/i18n.js';
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
     and above the install banner when it shows. Always in the page, so screen
     readers announce each toast added to it. -->
<div
    class="pointer-events-none fixed inset-x-4 z-200 flex flex-col items-center gap-2 {installStore.bannerVisible ? 'bottom-[calc(11rem+env(safe-area-inset-bottom))] md:bottom-32' : 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6'}"
    role="status"
    aria-live="polite"
>
    {#each $toasts as toast (toast.id)}
        {@const Icon = icons[toast.type]}
        <!-- Stays while the pointer moves over it or it is focused (a pause, not
             an action); an error can be closed. Appearing under a still pointer
             (Chrome then sends a move of 0 px) does not pause it. -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="pointer-events-auto flex max-w-sm items-center gap-2 rounded-card bg-foreground/90 py-2 pl-2.5 text-sm text-background shadow-lg backdrop-blur-md {toast.type === 'error' ? 'pr-1' : 'pr-4'}"
            in:fly={{ y: 20, duration: 200 }}
            out:fade={{ duration: 150 }}
            onpointermove={(e) => { if (e.movementX || e.movementY) toasts.pause(toast.id); }}
            onpointerleave={() => toasts.resume(toast.id)}
            onfocusin={() => toasts.pause(toast.id)}
            onfocusout={() => toasts.resume(toast.id)}
            data-toast
        >
            <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full {colors[toast.type]}" aria-hidden="true">
                <Icon class="h-3 w-3 text-background" strokeWidth={3} />
            </div>
            <p class="font-medium">{toast.message}</p>
            {#if toast.type === 'error'}
                <button
                    type="button"
                    onclick={() => toasts.remove(toast.id)}
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-background/80 transition-colors hover:bg-background/15 hover:text-background"
                    aria-label={$t('common.close')}
                >
                    <X class="h-4 w-4" />
                </button>
            {/if}
        </div>
    {/each}
</div>
