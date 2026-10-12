<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { LucideProps } from '@lucide/svelte';
  import { t } from '#lib/i18n.js';
  import Modal from './Modal.svelte';
  import ModalHeader from './ModalHeader.svelte';
  import { Button } from '#lib/components/ui/button/index.js';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    icon: Component<LucideProps>;
    tone?: 'primary' | 'success' | 'destructive' | 'muted';
    /** Adds the "Got it" button that closes the modal */
    dismissible?: boolean;
    children?: Snippet;
  }

  let {
    isOpen = false,
    onClose,
    title,
    description,
    icon,
    tone = 'primary',
    dismissible = false,
    children
  }: Props = $props();
</script>

<Modal {isOpen} {onClose} label={title}>
    <ModalHeader {title} {description} {icon} {tone} />

    <div class="space-y-4">
        {@render children?.()}

        {#if dismissible}
            <Button class="w-full" onclick={onClose}>
                {$t('common.got_it')}
            </Button>
        {/if}
    </div>
</Modal>
