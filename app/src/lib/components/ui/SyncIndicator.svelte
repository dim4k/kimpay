<script lang="ts">
    import { offlineService } from '$lib/services/offline.svelte';
    import { storageService } from '$lib/services/storage';
    import { CloudOff, RefreshCw } from 'lucide-svelte';
    import { t } from '$lib/i18n';

    // Derive pending count reactively by checking storage
    const pendingCount = $derived(storageService.getPendingActions().length);
    const isSyncing = $derived(offlineService.isSyncing);
    const isOffline = $derived(offlineService.isOffline);

    // Only show when there's something to report
    const shouldShow = $derived(isOffline || pendingCount > 0 || isSyncing);
</script>

{#if shouldShow}
    <div 
        class="fixed bottom-20 left-4 z-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-2 shadow-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left-2 duration-300"
        role="status"
        aria-live="polite"
    >
        {#if isSyncing}
            <RefreshCw class="h-4 w-4 animate-spin text-indigo-500" />
            <span class="text-slate-600 dark:text-slate-300">{$t('sync.syncing')}</span>
        {:else if isOffline && pendingCount > 0}
            <CloudOff class="h-4 w-4 text-amber-500" />
            <span class="text-slate-600 dark:text-slate-300">
                {pendingCount} {$t('sync.pending')}
            </span>
        {:else if isOffline}
            <CloudOff class="h-4 w-4 text-slate-400" />
            <span class="text-slate-500 dark:text-slate-400">{$t('sync.offline')}</span>
        {/if}
    </div>
{/if}
