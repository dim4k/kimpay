<script lang="ts">
    import { Button } from "#lib/components/ui/button/index.js";
    import { CircleAlert, Info, CircleCheck } from "@lucide/svelte";
    import { t } from '#lib/i18n.js';
    import Modal from './Modal.svelte';
    import ModalHeader from './ModalHeader.svelte';

    let { isOpen, title, message, variant = 'error', onConfirm }: {
        isOpen: boolean;
        title?: string;
        message: string;
        variant?: 'error' | 'info' | 'success';
        onConfirm: () => void;
    } = $props();

    const icons = { error: CircleAlert, success: CircleCheck, info: Info };
    const tones = { error: 'destructive', success: 'success', info: 'primary' } as const;
</script>

<Modal {isOpen} onClose={onConfirm} label={title || message}>
    {#if title}
        <ModalHeader {title} description={message} icon={icons[variant]} tone={tones[variant]} />
    {:else}
        <ModalHeader title={message} icon={icons[variant]} tone={tones[variant]} />
    {/if}

    <Button class="w-full" onclick={onConfirm}>
        {$t('common.ok')}
    </Button>
</Modal>
