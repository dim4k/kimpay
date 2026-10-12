<script lang="ts">
  import { Mail, ShieldAlert, KeyRound } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import BaseInfoModal from './BaseInfoModal.svelte';
  import InfoPoint from '#lib/components/ui/InfoPoint.svelte';

  let { isOpen = false, onClose }: { isOpen?: boolean; onClose: () => void } = $props();
</script>

<BaseInfoModal
    {isOpen}
    {onClose}
    title={$t('email_help.modal.title')}
    description={$t('email_help.modal.desc')}
    icon={Mail}

    dismissible
>
    <div class="space-y-2">
        <InfoPoint icon={KeyRound} title={$t('email_help.modal.point1.title')} description={$t('email_help.modal.point1.desc')} />
        <InfoPoint icon={ShieldAlert} title={$t('email_help.modal.point2.title')} description={$t('email_help.modal.point2.desc')} />
    </div>
</BaseInfoModal>
