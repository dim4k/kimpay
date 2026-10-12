<script lang="ts">
  import { TriangleAlert, CircleCheck } from "@lucide/svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { t } from '#lib/i18n.js';
  import Modal from './Modal.svelte';
  import ModalHeader from './ModalHeader.svelte';
  import ModalActions from './ModalActions.svelte';

  interface Props {
    isOpen?: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    isProcessing?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    isOpen = false,
    title,
    description,
    confirmText = $t('common.confirm'),
    cancelText = $t('common.cancel'),
    variant = "default",
    isProcessing = false,
    onConfirm,
    onCancel
  }: Props = $props();
</script>

<Modal {isOpen} onClose={isProcessing ? undefined : onCancel} label={title}>
    <ModalHeader
        {title}
        {description}
        icon={variant === 'destructive' ? TriangleAlert : CircleCheck}
        tone={variant === 'destructive' ? 'destructive' : 'primary'}
    />

    <ModalActions>
        <Button variant="secondary" onclick={onCancel} disabled={isProcessing}>
            {cancelText}
        </Button>
        <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onclick={onConfirm}
            loading={isProcessing}
        >
            {confirmText}
        </Button>
    </ModalActions>
</Modal>
