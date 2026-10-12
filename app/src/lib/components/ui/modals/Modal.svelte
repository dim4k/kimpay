<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { cn } from "#lib/utils/index.js";

  interface Props {
    isOpen: boolean;
    /** Omit to make the modal mandatory (no Escape / outside-click dismissal) */
    onClose?: (() => void) | undefined;
    /** `sheet` slides up from the bottom on phones (centered on larger screens) */
    variant?: 'dialog' | 'sheet';
    /** Accessible name of the dialog */
    label?: string;
    class?: string;
    backdropClass?: string;
    children?: Snippet;
  }

  let { isOpen = false, onClose, variant = 'dialog', label, class: className, backdropClass, children }: Props = $props();

  let dialog = $state<HTMLDialogElement>();
  let isSheet = $derived(variant === 'sheet');

  // Native modal dialog: top layer, focus trap, inert background, focus
  // restored on close, Escape handled by the browser (`cancel` event).
  $effect(() => {
    if (isOpen && dialog && !dialog.open) dialog.showModal();
  });

  function panelIn(node: Element) {
    return isSheet ? fly(node, { y: 48, duration: 300 }) : scale(node, { start: 0.95, opacity: 0, duration: 150 });
  }
</script>

{#if isOpen}
    <!-- The dialog fills the viewport and acts as the backdrop: a click on
         it (outside the panel) dismisses the modal. -->
    <dialog
        bind:this={dialog}
        aria-label={label}
        class={cn(
            "fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none justify-center bg-black/40 backdrop-blur-xs backdrop:bg-transparent",
            isSheet ? "items-end p-0 sm:items-center sm:p-4" : "items-center p-4",
            backdropClass
        )}
        transition:fade={{ duration: 150 }}
        oncancel={(e) => { e.preventDefault(); onClose?.(); }}
        onclick={(e) => { if (e.target === dialog) onClose?.(); }}
    >
        <div
            class={cn(
                "w-full space-y-6 border bg-card p-6 text-card-foreground shadow-2xl outline-hidden",
                isSheet
                    ? "max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-card pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-card sm:pb-6"
                    : "max-w-sm rounded-card",
                className
            )}
            in:panelIn
            tabindex="-1"
            autofocus
        >
            {@render children?.()}
        </div>
    </dialog>
{/if}
