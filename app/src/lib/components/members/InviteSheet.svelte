<script lang="ts">
    import { UserPlus } from "@lucide/svelte";
    import { t } from '#lib/i18n.js';
    import LinkShare from '#lib/components/LinkShare.svelte';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';

    interface Props {
        isOpen: boolean;
        onClose: () => void;
        /** Link opening the Kimpay */
        link: string;
        groupName: string;
        /** A member invited by name: the link opens the Kimpay as them */
        name?: string | undefined;
    }

    let { isOpen, onClose, link, groupName, name }: Props = $props();

    let title = $derived(name ? $t('members.invite_named', { name }) : $t('members.invite'));
</script>

<Modal {isOpen} {onClose} variant="sheet" label={title}>
    <ModalHeader {title} description={name ? $t('share.personal_desc', { name }) : $t('share.invite_friends')} icon={UserPlus} align="start" {onClose} />
    <LinkShare
        {link}
        shareTitle={$t('share.native_title', { name: groupName })}
        shareText={name ? $t('share.personal_text', { name }) : $t('share.native_text')}
        qrAlt={$t('share.qr_alt')}
    />
</Modal>
