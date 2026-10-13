<script lang="ts">
  import { Mail, KeyRound } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import BaseInfoModal from './BaseInfoModal.svelte';
  import InfoPoint from '#lib/components/ui/InfoPoint.svelte';
  import MagicLinkForm from '#lib/components/auth/MagicLinkForm.svelte';
  import { Button } from "#lib/components/ui/button/index.js";

  let { isOpen = false, onClose }: { isOpen?: boolean; onClose: () => void } = $props();

  // Mounted only while open (see GlobalModals). The form shows its own
  // success message; we only add a close button once the link is sent.
  let sent = $state(false);
</script>

<BaseInfoModal
    {isOpen}
    {onClose}
    title={$t('login_help.modal.title')}
    description={$t('login_help.modal.desc')}
    icon={Mail}

>
    <div class="space-y-4">
        <InfoPoint icon={KeyRound} title={$t('email_help.modal.point1.title')} description={$t('email_help.modal.point1.desc')} />

        <div class="pt-2">
            <MagicLinkForm successCallback={() => (sent = true)} />
        </div>

        {#if sent}
            <Button variant="outline" class="w-full" onclick={onClose}>{$t('common.got_it')}</Button>
        {/if}
    </div>
</BaseInfoModal>
