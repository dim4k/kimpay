<script lang="ts">
  import { WifiOff, Check, X } from "lucide-svelte";
  import { t } from '$lib/i18n';
  import BaseInfoModal from './BaseInfoModal.svelte';

  let { 
    isOpen = false, 
    onClose
  } = $props();
</script>

<BaseInfoModal 
    {isOpen} 
    {onClose}
    title={$t('offline.modal.title')}
    description={$t('offline.modal.desc')}
    icon={WifiOff}
    iconBgClass="bg-slate-100 dark:bg-slate-800"
    iconColorClass="text-slate-500 dark:text-slate-400"
>
    <!-- Can Do -->
    <div class="space-y-2">
        <h4 class="text-xs uppercase font-bold text-green-600 dark:text-green-500 tracking-wider flex items-center gap-2">
            {$t('offline.modal.can_do')}
        </h4>
        <ul class="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <li class="flex items-start gap-2">
                <Check class="h-4 w-4 text-green-500 mt-0.5" />
                <span>{$t('offline.modal.can_view')}</span>
            </li>
            <li class="flex items-start gap-2">
                <Check class="h-4 w-4 text-green-500 mt-0.5" />
                <span>{$t('offline.modal.can_create')}</span>
            </li>
        </ul>
    </div>

    <!-- Cannot Do -->
    <div class="space-y-2">
        <h4 class="text-xs uppercase font-bold text-red-500 dark:text-red-400 tracking-wider flex items-center gap-2">
            {$t('offline.modal.cannot_do')}
        </h4>
        <ul class="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <li class="flex items-start gap-2">
                <X class="h-4 w-4 text-red-500 mt-0.5" />
                <span>{$t('offline.modal.no_reimburse')}</span>
            </li>
            <li class="flex items-start gap-2">
                <X class="h-4 w-4 text-red-500 mt-0.5" />
                <span>{$t('offline.modal.no_sync')}</span>
            </li>
        </ul>
    </div>

    <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
        <p class="text-xs text-center text-slate-400 mb-4">
            {$t('offline.modal.sync_info')}
        </p>
        <button 
            class="w-full py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-colors"
            onclick={onClose}
        >
            {$t('common.got_it')}
        </button>
    </div>
</BaseInfoModal>
