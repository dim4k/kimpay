<script lang="ts">
  import { Mail, KeyRound } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import BaseInfoModal from './BaseInfoModal.svelte';
  import InfoPoint from '#lib/components/ui/InfoPoint.svelte';
  import MagicLinkForm from '#lib/components/auth/MagicLinkForm.svelte';
  import { Button } from "#lib/components/ui/button/index.js";

  let { isOpen = false, onClose }: { isOpen?: boolean; onClose: () => void } = $props();

  // The form (remounted on each opening) shows its own success message; we
  // only add a close button once the link is sent.
  let sent = $state(false);

  function close() {
      sent = false;
      onClose();
  }
</script>

<BaseInfoModal
    {isOpen}
    onClose={close}
    title={$t('login_help.modal.title')}
    description={$t('login_help.modal.desc')}
    icon={Mail}
    iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
    iconColorClass="text-indigo-500 dark:text-indigo-400"
>
    <div class="space-y-4">
        <InfoPoint icon={KeyRound} title={$t('email_help.modal.point1.title')} description={$t('email_help.modal.point1.desc')} />

        <div class="pt-2">
            <MagicLinkForm successCallback={() => (sent = true)} />
        </div>

        {#if sent}
            <Button variant="outline" class="w-full" onclick={close}>{$t('common.got_it')}</Button>
        {/if}
    </div>
</BaseInfoModal>
