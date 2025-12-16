<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { portal } from '$lib/actions/portal';
  import { cn } from "$lib/utils";
  import type { ComponentType } from 'svelte';

  let { 
    isOpen = false, 
    onClose,
    title,
    description,
    icon: Icon,
    iconColorClass = "text-indigo-500",
    iconBgClass = "bg-indigo-100 dark:bg-indigo-900/30",
    maxWidthClass = "max-w-sm",
    children
  } = $props<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    icon: ComponentType;
    iconColorClass?: string;
    iconBgClass?: string;
    maxWidthClass?: string;
    children?: import('svelte').Snippet;
  }>();

  function handleBackdropClick(e: MouseEvent) {
      if (e.target === e.currentTarget) onClose();
  }
</script>

{#if isOpen}
    <div 
        use:portal
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" 
        transition:fade 
        onclick={handleBackdropClick} 
        role="button" 
        tabindex="-1" 
        onkeydown={(e) => e.key === 'Escape' && onClose()}
    >
        <div 
            class={cn(
                "bg-white dark:bg-slate-900 rounded-3xl p-6 w-full shadow-2xl space-y-6 dark:border dark:border-slate-800 transition-colors",
                maxWidthClass
            )}
            transition:scale={{ start: 0.95, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            <div class="text-center space-y-2">
                 <div class={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4", iconBgClass, iconColorClass)}>
                    <Icon class="h-8 w-8" />
                 </div>
                 <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                 <p class="text-muted-foreground text-sm">
                    {description}
                 </p>
            </div>
            
            <div class="space-y-4">
                {@render children?.()}
            </div>
        </div>
    </div>
{/if}
