<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { portal } from '$lib/actions/portal';
  import { cn } from "$lib/utils";

  let { 
    isOpen = false, 
    onClose,
    class: className,
    backdropClass,
    children
  } = $props<{
    isOpen: boolean;
    onClose?: (() => void) | undefined;
    class?: string;
    backdropClass?: string;
    children?: import('svelte').Snippet;
  }>();

  function handleBackdropClick(e: MouseEvent) {
      if (e.target === e.currentTarget && onClose) onClose();
  }
</script>

{#if isOpen}
    <div 
        use:portal
        class={cn("fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm", backdropClass)}
        transition:fade 
        onclick={handleBackdropClick} 
        role="button" 
        tabindex="-1" 
        onkeydown={(e) => e.key === 'Escape' && onClose?.()}
    >
        <div 
            class={cn(
                "bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-6 dark:border dark:border-slate-800 transition-colors",
                className
            )}
            transition:scale={{ start: 0.95, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            {@render children?.()}
        </div>
    </div>
{/if}
