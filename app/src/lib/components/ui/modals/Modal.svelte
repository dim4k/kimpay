<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cn } from "#lib/utils/index.js";

  interface Props {
    isOpen: boolean;
    /** Omit to make the modal mandatory (no Escape / outside-click dismissal) */
    onClose?: (() => void) | undefined;
    class?: string;
    backdropClass?: string;
    children?: Snippet;
  }

  let { isOpen = false, onClose, class: className, backdropClass, children }: Props = $props();

  let dialog = $state<HTMLDialogElement>();

  // Native modal dialog: top layer, focus trap, inert background, focus
  // restored on close, Escape handled by the browser (`cancel` event).
  $effect(() => {
    if (isOpen && dialog && !dialog.open) dialog.showModal();
  });
</script>

{#if isOpen}
    <!-- The dialog fills the viewport and acts as the backdrop: a click on
         it (outside the panel) dismisses the modal. -->
    <dialog
        bind:this={dialog}
        class={cn(
            "fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none items-center justify-center bg-black/40 p-4 backdrop-blur-xs backdrop:bg-transparent",
            backdropClass
        )}
        transition:fade
        oncancel={(e) => { e.preventDefault(); onClose?.(); }}
        onclick={(e) => { if (e.target === dialog) onClose?.(); }}
    >
        <div
            class={cn(
                "bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-6 dark:border dark:border-slate-800 transition-colors outline-hidden",
                className
            )}
            transition:scale={{ start: 0.95, opacity: 0 }}
            tabindex="-1"
            autofocus
        >
            {@render children?.()}
        </div>
    </dialog>
{/if}
