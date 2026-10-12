<script lang="ts">
  import { WifiOff, Check, X } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import BaseInfoModal from './BaseInfoModal.svelte';

  let { isOpen = false, onClose }: { isOpen?: boolean; onClose: () => void } = $props();
</script>

<BaseInfoModal 
    {isOpen} 
    {onClose}
    title={$t('offline.modal.title')}
    description={$t('offline.modal.desc')}
    icon={WifiOff}
    iconBgClass="bg-muted"
    iconColorClass="text-muted-foreground"
    dismissible
>
    <!-- Can Do -->
    <div class="space-y-2">
        <h4 class="flex items-center gap-2 text-sm font-semibold text-success">
            {$t('offline.modal.can_do')}
        </h4>
        <ul class="space-y-1.5 text-sm text-muted-foreground">
            <li class="flex items-start gap-2">
                <Check class="mt-0.5 h-4 w-4 text-success" />
                <span>{$t('offline.modal.can_view')}</span>
            </li>
            <li class="flex items-start gap-2">
                <Check class="mt-0.5 h-4 w-4 text-success" />
                <span>{$t('offline.modal.can_create')}</span>
            </li>
        </ul>
    </div>

    <!-- Cannot Do -->
    <div class="space-y-2">
        <h4 class="flex items-center gap-2 text-sm font-semibold text-destructive">
            {$t('offline.modal.cannot_do')}
        </h4>
        <ul class="space-y-1.5 text-sm text-muted-foreground">
            <li class="flex items-start gap-2">
                <X class="mt-0.5 h-4 w-4 text-destructive" />
                <span>{$t('offline.modal.no_reimburse')}</span>
            </li>
            <li class="flex items-start gap-2">
                <X class="mt-0.5 h-4 w-4 text-destructive" />
                <span>{$t('offline.modal.no_sync')}</span>
            </li>
        </ul>
    </div>

    <div class="border-t pt-2">
        <p class="text-center text-xs text-muted-foreground">
            {$t('offline.modal.sync_info')}
        </p>
    </div>
</BaseInfoModal>
