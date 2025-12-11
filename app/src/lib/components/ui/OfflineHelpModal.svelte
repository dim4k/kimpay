<script lang="ts">
  import { WifiOff, Check, X } from "lucide-svelte";
  import { fade, scale } from 'svelte/transition';
  import { portal } from '$lib/actions/portal';
  import { t } from '$lib/i18n';

  let { 
    isOpen = false, 
    onClose
  } = $props();

  function handleBackdropClick(e: MouseEvent) {
      if (e.target === e.currentTarget) onClose();
  }
</script>

{#if isOpen}
    <div 
        use:portal
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" 
        transition:fade 
        onclick={handleBackdropClick} 
        role="button" 
        tabindex="-1" 
        onkeydown={(e) => e.key === 'Escape' && onClose()}
    >
        <div 
            class="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-6 dark:border dark:border-slate-800 transition-colors" 
            transition:scale={{ start: 0.95, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            <div class="text-center space-y-2">
                 <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <WifiOff class="h-8 w-8" />
                 </div>
                 <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100">{$t('offline.modal.title')}</h3>
                 <p class="text-muted-foreground text-sm">
                    {$t('offline.modal.desc')}
                 </p>
            </div>
            
            <div class="space-y-4">
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
        </div>
    </div>
{/if}
