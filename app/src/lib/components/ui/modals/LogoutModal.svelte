<script lang="ts">
    import { LogOut } from "@lucide/svelte";
    import { onMount } from 'svelte';
    import { t } from '#lib/i18n.js';
    import { Button } from "#lib/components/ui/button/index.js";
    import Switch from '#lib/components/ui/Switch.svelte';
    import Modal from './Modal.svelte';
    import ModalHeader from './ModalHeader.svelte';
    import ModalActions from './ModalActions.svelte';
    import { storageService } from '#lib/services/storage.js';
    import { logout } from '#lib/services/session.js';
    import { notifyError } from '#lib/utils/notify.js';

    // Mounted only while open (see GlobalModals).
    let { onClose }: { onClose: () => void } = $props();

    let forgetDevice = $state(false);
    // Changes made offline, not sent yet: removing the groups would lose them.
    let hasPending = $state(false);
    let isProcessing = $state(false);

    onMount(async () => {
        hasPending = (await storageService.getPendingActions()).length > 0;
    });

    async function confirm() {
        isProcessing = true;
        try {
            await logout({ forgetDevice: forgetDevice && !hasPending });
        } catch (e) {
            notifyError(e, "Logout failed");
            isProcessing = false;
        }
    }
</script>

<Modal isOpen={true} onClose={isProcessing ? undefined : onClose} label={$t('modal.logout.title')}>
    <ModalHeader
        title={$t('modal.logout.title')}
        description={$t('modal.logout.desc')}
        icon={LogOut}
        tone="destructive"
    />

    <div class="flex items-center gap-3 rounded-control border p-3">
        <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{$t('modal.logout.forget')}</p>
            <p class="text-xs text-muted-foreground">
                {hasPending ? $t('modal.logout.forget_pending') : $t('modal.logout.forget_hint')}
            </p>
        </div>
        <Switch
            checked={forgetDevice && !hasPending}
            label={$t('modal.logout.forget')}
            onchange={(checked) => (forgetDevice = checked)}
            disabled={hasPending || isProcessing}
        />
    </div>

    <ModalActions>
        <Button variant="secondary" onclick={onClose} disabled={isProcessing}>
            {$t('common.cancel')}
        </Button>
        <Button variant="destructive" onclick={confirm} loading={isProcessing}>
            {$t('modal.logout.confirm')}
        </Button>
    </ModalActions>
</Modal>
