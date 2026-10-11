<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { LucideProps } from '@lucide/svelte';
  import { cn } from "#lib/utils/index.js";
  import { t } from '#lib/i18n.js';
  import Modal from './Modal.svelte';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    icon: Component<LucideProps>;
    iconColorClass?: string;
    iconBgClass?: string;
    maxWidthClass?: string;
    /** Adds the "Got it" button that closes the modal */
    dismissible?: boolean;
    children?: Snippet;
  }

  let {
    isOpen = false,
    onClose,
    title,
    description,
    icon: Icon,
    iconColorClass = "text-indigo-500",
    iconBgClass = "bg-indigo-100 dark:bg-indigo-900/30",
    maxWidthClass = "max-w-sm",
    dismissible = false,
    children
  }: Props = $props();
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

        {#if dismissible}
            <button
                class="w-full py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-colors"
                onclick={onClose}
            >
                {$t('common.got_it')}
            </button>
        {/if}
    </div>
</Modal>
