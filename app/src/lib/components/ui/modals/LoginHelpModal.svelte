<script lang="ts">
  import { Mail, KeyRound } from "lucide-svelte";
  import { t } from '$lib/i18n';
  import BaseInfoModal from './BaseInfoModal.svelte';
  import MagicLinkForm from '$lib/components/auth/MagicLinkForm.svelte';
  import { Button } from "$lib/components/ui/button";

  let { 
    isOpen = false, 
    onClose
  } = $props();

  let success = $state(false);

  $effect(() => {
    if (isOpen) {
        success = false;
    }
  });

  function onSuccess() {
      success = true;
  }
</script>

<BaseInfoModal 
    {isOpen} 
    {onClose}
    title={$t('login_help.modal.title', { default: 'Why log in?' })}
    description={$t('login_help.modal.desc', { default: 'Secure your access and find your kimpays everywhere.' })}
    icon={Mail}
    iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
    iconColorClass="text-indigo-500 dark:text-indigo-400"
>
    <div class="space-y-4">
        <div class="space-y-2">
            <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <KeyRound class="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                <div class="text-sm">
                    <span class="font-bold text-slate-800 dark:text-slate-200 block">{$t('email_help.modal.point1.title', { default: 'Magic Link Login' })}</span>
                    <span class="text-slate-500 dark:text-slate-400 text-xs">{$t('email_help.modal.point1.desc', { default: 'We send you a secure link to log in.' })}</span>
                </div>
            </div>
        </div>

        {#if success}
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3 text-green-700 dark:text-green-300">
                <div class="text-sm">
                    <p class="font-medium">{$t('home.recover.success_title', { default: 'Link sent!' })}</p>
                    <p class="text-xs opacity-90">{$t('home.recover.success_desc', { default: 'Check your email inbox.' })}</p>
                </div>
            </div>
            <Button variant="outline" class="w-full" onclick={onClose}>{$t('common.got_it')}</Button>
        {:else}
             <div class="pt-2">
                <MagicLinkForm 
                    buttonTextKey="home.recover.button"
                    successCallback={onSuccess}
                />
             </div>
        {/if}
    </div>
</BaseInfoModal>
