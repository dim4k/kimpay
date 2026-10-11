<script lang="ts">
  import { Mail, ShieldAlert, KeyRound } from "@lucide/svelte";
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
    title={$t('email_help.modal.title')}
    description={$t('email_help.modal.desc')}
    icon={Mail}
    iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
    iconColorClass="text-indigo-500 dark:text-indigo-400"
>
    <div class="space-y-2">
        <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <KeyRound class="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
            <div class="text-sm">
                <span class="font-bold text-slate-800 dark:text-slate-200 block">{$t('email_help.modal.point1.title')}</span>
                <span class="text-slate-500 dark:text-slate-400">{$t('email_help.modal.point1.desc')}</span>
            </div>
        </div>

        <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <ShieldAlert class="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
            <div class="text-sm">
                <span class="font-bold text-slate-800 dark:text-slate-200 block">{$t('email_help.modal.point2.title')}</span>
                <span class="text-slate-500 dark:text-slate-400">{$t('email_help.modal.point2.desc')}</span>
            </div>
        </div>
    </div>

    <div class="pt-2">
        <button 
            class="w-full py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-colors"
            onclick={onClose}
        >
            {$t('common.got_it')}
        </button>
    </div>
</BaseInfoModal>
