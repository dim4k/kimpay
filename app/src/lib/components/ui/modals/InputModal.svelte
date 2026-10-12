<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { t } from '#lib/i18n.js';
  import Modal from './Modal.svelte';
  import ModalHeader from './ModalHeader.svelte';
  import ModalActions from './ModalActions.svelte';

  interface Props {
      isOpen?: boolean;
      title: string;
      placeholder?: string;
      confirmText?: string;
      cancelText?: string;
      isProcessing?: boolean;
      maxlength?: number;
      onConfirm: (value: string) => void;
      onCancel: () => void;
  }

  let {
      isOpen = false,
      title,
      placeholder = "",
      confirmText = $t('common.confirm'),
      cancelText = $t('common.cancel'),
      isProcessing = false,
      maxlength,
      onConfirm,
      onCancel
  }: Props = $props();

  let value = $state("");

  function handleSubmit() {
      if (value.trim()) {
          onConfirm(value);
          value = ""; // Reset after submit
      }
  }
</script>

<Modal {isOpen} onClose={isProcessing ? undefined : onCancel} label={title}>
    <ModalHeader {title} />

    <Input
        bind:value={value}
        {placeholder}
        {maxlength}
        aria-label={title}
        autofocus
        onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
    />

    <ModalActions>
        <Button variant="secondary" onclick={onCancel} disabled={isProcessing}>
            {cancelText}
        </Button>
        <Button onclick={handleSubmit} loading={isProcessing} disabled={!value.trim()}>
            {confirmText}
        </Button>
    </ModalActions>
</Modal>
