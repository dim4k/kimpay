<script lang="ts">
    import { Check, Copy, Link, LoaderCircle, Share2, UserPlus } from "@lucide/svelte";
    import QRCode from 'qrcode';
    import { t } from '#lib/i18n.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { haptic } from '#lib/utils/haptic.js';

    interface Props {
        isOpen: boolean;
        onClose: () => void;
        /** Link opening the group */
        link: string;
        groupName: string;
        /** A member invited by name: the link opens the group as them */
        name?: string | undefined;
    }

    let { isOpen, onClose, link, groupName, name }: Props = $props();

    let title = $derived(name ? $t('members.invite_named', { name }) : $t('members.invite'));

    let copied = $state(false);
    let qrDataUrl = $state<string | null>(null);
    let canShare = typeof navigator !== 'undefined' && !!navigator.share;

    // Dark modules on white: drawn on a white tile in both themes, which
    // is what phone cameras read best.
    $effect(() => {
        if (!isOpen || !link) return;
        QRCode.toDataURL(link, { width: 300, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } })
            .then((url) => (qrDataUrl = url))
            .catch((err) => console.error("QR Generation failed", err));
    });

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(link);
            haptic('light');
            toasts.success($t('share.copy_success'));
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
            toasts.error($t('share.copy_error'));
        }
    }

    async function shareNative() {
        try {
            await navigator.share({
                title: $t('share.native_title', { name: groupName }),
                text: name ? $t('share.personal_text', { name }) : $t('share.native_text'),
                url: link,
            });
        } catch {
            // Share sheet dismissed.
        }
    }
</script>

<Modal {isOpen} {onClose} variant="sheet" label={title}>
    <ModalHeader {title} description={name ? $t('share.personal_desc', { name }) : $t('share.invite_friends')} icon={UserPlus} align="start" {onClose} />

    {#if canShare}
        <Button size="lg" class="w-full" onclick={shareNative}>
            <Share2 class="size-5!" />
            {$t('share.invite_button')}
        </Button>
    {/if}

    <div class="flex items-center gap-2 rounded-control bg-muted py-1 pl-3 pr-1">
        <Link class="h-4 w-4 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1 truncate font-mono text-sm text-muted-foreground">{link}</span>
        <Button size="sm" variant={canShare ? 'soft' : 'default'} onclick={copyLink}>
            {#if copied}
                <Check />
                {$t('share.copy_success')}
            {:else}
                <Copy />
                {$t('share.copy_button')}
            {/if}
        </Button>
    </div>

    <div class="flex flex-col items-center gap-3">
        <div class="rounded-control bg-white p-2">
            {#if qrDataUrl}
                <img src={qrDataUrl} alt={$t('share.qr_alt')} class="h-44 w-44" />
            {:else}
                <div class="flex h-44 w-44 items-center justify-center text-muted-foreground">
                    <LoaderCircle class="h-8 w-8 animate-spin" />
                </div>
            {/if}
        </div>
        <p class="text-center text-sm text-muted-foreground">{$t('share.qr_desc')}</p>
    </div>
</Modal>
