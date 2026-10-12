<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { LucideProps } from '@lucide/svelte';
  import { cn } from "#lib/utils/index.js";
  import { t } from '#lib/i18n.js';
  import Modal from './Modal.svelte';
  import { Button } from '#lib/components/ui/button/index.js';

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
    iconColorClass = "text-primary-soft-foreground",
    iconBgClass = "bg-primary-soft",
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
            <h3 class="text-xl font-bold">{title}</h3>
            <p class="text-muted-foreground text-sm">
            {description}
            </p>
    </div>

    <div class="space-y-4">
        {@render children?.()}

        {#if dismissible}
            <Button class="w-full" onclick={onClose}>
                {$t('common.got_it')}
            </Button>
        {/if}
    </div>
</Modal>
