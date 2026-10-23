<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { ChevronDown } from '@lucide/svelte';
  import { cn } from "#lib/utils/index.js";
  import { t } from '#lib/i18n.js';
  import { layout } from '#lib/stores/layout.svelte.js';

  interface Props {
    isOpen: boolean;
    /** Omit to make the modal mandatory (no Escape / outside-click dismissal) */
    onClose?: (() => void) | undefined;
    /** `sheet` slides up from the bottom on phones (centered on larger screens) */
    variant?: 'dialog' | 'sheet';
    /**
     * A sheet that opens beside the page on computers (from `md`), the page
     * still usable: an expense, a member, a category. Not for what asks a
     * question (those stay over the page).
     */
    panel?: boolean;
    /**
     * The button a sheet opens from (the header's): on computers (from
     * `md`), a menu under it instead, lined up with its `align` edge.
     */
    anchor?: HTMLElement | undefined;
    align?: 'start' | 'end';
    /** Accessible name of the dialog */
    label?: string;
    class?: string;
    backdropClass?: string;
    /** Stays at the top while the content scrolls (e.g. a form's title) */
    header?: Snippet;
    /** Stays at the bottom while the content scrolls (e.g. a form's save button) */
    footer?: Snippet | undefined;
    children?: Snippet;
  }

  let { isOpen = false, onClose, variant = 'dialog', panel = false, anchor, align = 'start', label, class: className, backdropClass, header, footer, children }: Props = $props();

  let dialog = $state<HTMLDialogElement>();
  let isSheet = $derived(variant === 'sheet');
  let isPanel = $derived(isSheet && panel && layout.wide);
  let isMenu = $derived(isSheet && !!anchor && !panel && layout.wide);

  // Native modal dialog: top layer, focus trap, inert background, focus
  // restored on close, Escape handled by the browser (`cancel` event).
  $effect(() => {
    if (isOpen && dialog && !dialog.open) dialog.showModal();
  });

  // A panel is not modal: it takes the focus when it opens, gives it back
  // when it closes (unless the focus went elsewhere, e.g. another expense of
  // the list clicked), and closes with Escape unless a dialog is over it.
  let panelEl = $state<HTMLElement>();

  $effect(() => {
    const node = panelEl;
    if (!node) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.focus({ preventScroll: true });
    untrack(() => layout.panels++);
    return () => {
      untrack(() => layout.panels--);
      const focus = document.activeElement;
      if (opener?.isConnected && (!focus || focus === document.body || node.contains(focus))) opener.focus({ preventScroll: true });
    };
  });

  // A menu: under its button (kept there when the window is resized), closed
  // by a click elsewhere, except on its button (which toggles it) or in a
  // dialog opened from it. The focus comes and goes as for a panel.
  let menuEl = $state<HTMLElement>();
  let menuAt = $state<{ top: number; left?: number; right?: number }>({ top: 0 });

  $effect(() => {
    const node = menuEl;
    const button = anchor;
    if (!node || !button) return;
    const place = () => {
      const box = button.getBoundingClientRect();
      menuAt = align === 'end'
        ? { top: box.bottom + 8, right: document.documentElement.clientWidth - box.right }
        : { top: box.bottom + 8, left: box.left };
    };
    place();
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.focus({ preventScroll: true });
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (node.contains(target) || button.contains(target) || target.closest('dialog')) return;
      onClose?.();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', place);
      const focus = document.activeElement;
      if (opener?.isConnected && (!focus || focus === document.body || node.contains(focus))) opener.focus({ preventScroll: true });
    };
  });

  function panelKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog:modal')) return;
    e.preventDefault();
    onClose?.();
  }

  // Sheets (phones): drag the handle down to dismiss, or tap it.
  let dragFrom = $state<{ y: number; time: number } | null>(null);
  let dragY = $state(0);
  let dragged = false;

  function dragStart(e: PointerEvent) {
    dragFrom = { y: e.clientY, time: e.timeStamp };
    dragged = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function dragMove(e: PointerEvent) {
    if (!dragFrom) return;
    dragY = Math.max(0, e.clientY - dragFrom.y);
    if (dragY > 4) dragged = true;
  }

  function dragEnd(e: PointerEvent) {
    if (!dragFrom) return;
    const distance = e.clientY - dragFrom.y;
    const speed = distance / Math.max(1, e.timeStamp - dragFrom.time);
    dragFrom = null;
    // Far enough, or flicked: close (the panel leaves from where it is).
    if (distance > 80 || speed > 0.5) onClose?.();
    else dragY = 0;
  }

  // With a header or a footer, only the content in between scrolls: what is
  // left below it fades out and the footer casts a shadow over it.
  let framed = $derived(!!header || !!footer);
  let body = $state<HTMLElement>();
  let content = $state<HTMLElement>();
  let moreBelow = $state(false);

  function measure() {
    if (body) moreBelow = body.scrollHeight - body.scrollTop - body.clientHeight > 4;
  }

  $effect(() => {
    if (!body || !content) return;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(content);
    return () => observer.disconnect();
  });

  function panelIn(node: Element) {
    return isSheet ? fly(node, { y: 48, duration: 300 }) : scale(node, { start: 0.95, opacity: 0, duration: 150 });
  }
</script>

<!-- The content, framed (a header and a footer that stay, the rest
     scrolling) or not: the same in a sheet, a dialog or a panel. -->
{#snippet inner()}
    {#if framed}
        {#if header}
            <header class="shrink-0 px-6 pt-6 pb-2">
                {@render header()}
            </header>
        {/if}
        <div class="relative flex min-h-0 flex-1 flex-col">
            <div bind:this={body} class="min-h-0 flex-1 overflow-y-auto overscroll-contain" onscroll={measure}>
                <div bind:this={content} class="space-y-6 px-6 pt-2 pb-6">
                    {@render children?.()}
                </div>
            </div>
            <div
                class="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-center bg-linear-to-b from-transparent to-card to-85% pb-1 transition-opacity duration-200 {moreBelow ? 'opacity-100' : 'opacity-0'}"
                aria-hidden="true"
            >
                <ChevronDown class="h-4 w-4 text-primary motion-safe:animate-bounce" />
            </div>
        </div>
        {#if footer}
            <div class="shrink-0 border-t bg-card px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-shadow duration-200 sm:pb-3 {moreBelow ? 'shadow-[0_-10px_18px_-12px_rgb(0_0_0/0.35)]' : ''}">
                {@render footer()}
            </div>
        {/if}
    {:else}
        {@render children?.()}
    {/if}
{/snippet}

<svelte:window onkeydown={(e) => { if (isOpen && (isPanel || isMenu)) panelKeydown(e); }} />

{#if isOpen && isPanel}
    <!-- Over the page while it has no room for it (md), beside it from lg. -->
    <div class="fixed inset-x-0 bottom-0 top-14 z-30 bg-black/30 lg:hidden" onclick={() => onClose?.()} transition:fade={{ duration: 150 }} aria-hidden="true"></div>
    <div
        bind:this={panelEl}
        role="dialog"
        aria-label={label}
        tabindex="-1"
        class={cn(
            "fixed bottom-0 right-0 top-14 z-30 w-(--panel-width) max-w-full border-l bg-card text-card-foreground shadow-xl outline-hidden lg:shadow-none",
            framed ? "flex flex-col" : "space-y-6 overflow-y-auto overscroll-contain p-6",
            className
        )}
        in:fly={{ x: 48, duration: 200 }}
    >
        {@render inner()}
    </div>
{:else if isOpen && isMenu}
    <div
        bind:this={menuEl}
        role="dialog"
        aria-label={label}
        tabindex="-1"
        class={cn(
            "fixed z-50 max-h-[calc(100dvh-5rem)] w-96 max-w-[calc(100vw-2rem)] rounded-card border bg-card text-card-foreground shadow-2xl outline-hidden",
            align === 'end' ? 'origin-top-right' : 'origin-top-left',
            framed ? "flex flex-col overflow-hidden" : "space-y-6 overflow-y-auto overscroll-contain p-6",
            className
        )}
        style:top="{menuAt.top}px"
        style:left={menuAt.left !== undefined ? `${menuAt.left}px` : undefined}
        style:right={menuAt.right !== undefined ? `${menuAt.right}px` : undefined}
        transition:scale={{ start: 0.96, opacity: 0, duration: 120 }}
    >
        {@render inner()}
    </div>
{:else if isOpen}
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
        oncancel={(e) => {
            // A file picker dismissed inside fires a bubbling `cancel` too: only the dialog's own (Escape) closes it.
            if (e.target !== dialog) return;
            e.preventDefault();
            onClose?.();
        }}
        onclick={(e) => { if (e.target === dialog) onClose?.(); }}
    >
        <div
            class={cn(
                "relative w-full border bg-card text-card-foreground shadow-2xl outline-hidden",
                framed ? "flex flex-col overflow-hidden" : "space-y-6 p-6",
                !dragFrom && "transition-transform duration-200",
                isSheet
                    ? cn("max-h-[90dvh] max-w-lg rounded-t-card sm:rounded-card", !framed && "overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6")
                    : "max-w-sm rounded-card",
                className
            )}
            style:transform={dragY ? `translateY(${dragY}px)` : undefined}
            in:panelIn
            tabindex="-1"
            autofocus
        >
            {#if isSheet && onClose}
                <!-- Grab handle (phones only: the sheet is centered on larger screens). -->
                <button
                    type="button"
                    class="absolute inset-x-0 top-0 flex h-6 cursor-grab touch-none items-center justify-center sm:hidden"
                    aria-label={$t('common.close')}
                    onpointerdown={dragStart}
                    onpointermove={dragMove}
                    onpointerup={dragEnd}
                    onpointercancel={dragEnd}
                    onclick={() => { if (!dragged) onClose?.(); }}
                >
                    <span class="h-1 w-10 rounded-full bg-muted-foreground/30"></span>
                </button>
            {/if}
            {@render inner()}
        </div>
    </dialog>
{/if}
