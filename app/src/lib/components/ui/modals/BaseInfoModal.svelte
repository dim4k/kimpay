<script lang="ts">
  import { cn } from "$lib/utils";
  import type { ComponentType } from 'svelte';
  import Modal from './Modal.svelte';

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
</script>

<Modal {isOpen} {onClose} class={maxWidthClass}>
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
</Modal>
