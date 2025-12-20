<script lang="ts">
    import { Pencil, Trash2, Image as ImageIcon, Camera, HandCoins, Undo2 } from "lucide-svelte";
    import { t } from '$lib/i18n';
    import { slide } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { cubicOut } from 'svelte/easing';
    import { offlineService } from '$lib/services/offline.svelte';
    import { formatAmount } from '$lib/services/currency';

    let { 
        expense, 
        currentUserId, 
        expandedId, 
        kimpayId,
        onToggleExpand,
        onRequestDelete,
        onOpenGallery,
        style = ""
    } = $props();

    function slideFade(node: Element, { delay = 0, duration = 400, easing = cubicOut, y = 20 }) {
      const style = getComputedStyle(node);
      const opacity = +style.opacity;
      const height = parseFloat(style.height);
      const padding_top = parseFloat(style.paddingTop);
      const padding_bottom = parseFloat(style.paddingBottom);
      const margin_top = parseFloat(style.marginTop);
      const margin_bottom = parseFloat(style.marginBottom);
      const border_top_width = parseFloat(style.borderTopWidth);
      const border_bottom_width = parseFloat(style.borderBottomWidth);

      return {
          delay,
          duration,
          easing,
          css: (t: number) => `
              overflow: hidden;
              opacity: ${t * opacity};
              height: ${t * height}px;
              padding-top: ${t * padding_top}px;
              padding-bottom: ${t * padding_bottom}px;
              margin-top: ${t * margin_top}px;
              margin-bottom: ${t * margin_bottom}px;
              border-top-width: ${t * border_top_width}px;
              border-bottom-width: ${t * border_bottom_width}px;
              transform: translateY(${(1 - t) * y}px);
          `
      };
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(expense.id);
        }
    }
</script>

<div 
    class="expense-item rounded-xl border shadow-sm overflow-hidden group transition-all duration-300 {expense.is_reimbursement ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-card hover:border-indigo-200 dark:hover:border-indigo-900'}"
    
    class:ring-2={expandedId === expense.id}
    class:ring-indigo-500={expandedId === expense.id && !expense.is_reimbursement}
    class:dark:ring-indigo-400={expandedId === expense.id && !expense.is_reimbursement}
    class:ring-emerald-500={expandedId === expense.id && expense.is_reimbursement}
    class:dark:ring-emerald-400={expandedId === expense.id && expense.is_reimbursement}
    {style}
    role="button"
    tabindex="0"
    onclick={() => onToggleExpand(expense.id)}
    onkeydown={handleKeydown}
>
    <!-- Main Row (Always Visible) -->
    <div 
        class="flex justify-between items-center p-4 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
    >
        <div class="flex items-center gap-4 flex-1 min-w-0 mr-2">
            <div 
                class="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xl border transition-colors relative {expense.is_reimbursement ? 'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}"
            >
                    {#if expense.is_reimbursement}
                        <HandCoins class="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    {:else}
                        {expense.icon || '💸'}
                    {/if}
                    <!-- Camera indicator if collapsed -->
                    {#if (!expandedId || expandedId !== expense.id) && expense.photos && expense.photos.length > 0}
                    <div class="absolute -top-1.5 -right-1.5 h-5 w-5 bg-indigo-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                        <Camera class="h-2.5 w-2.5 text-white" />
                    </div>
                    {/if}
            </div>
            <div class="flex flex-col min-w-0">
                <span class="font-medium text-slate-900 dark:text-slate-100 transition-colors truncate text-base">
                    {expense.is_reimbursement ? $t('balance.reimbursement') : expense.description}
                </span>
                {#if expense.is_reimbursement}
                     <div class="flex flex-wrap gap-x-2 text-xs text-muted-foreground dark:text-slate-400 transition-colors mt-0.5">
                        <span class="font-medium text-emerald-600 dark:text-emerald-400">
                            {$t('expense.list.reimbursement', {
                                from: currentUserId && expense.payer === currentUserId ? $t('common.you') : (expense.expand?.payer?.name || $t('common.unknown')),
                                to: currentUserId && expense.expand?.involved?.[0]?.id === currentUserId ? $t('common.you') : (expense.expand?.involved?.[0]?.name || $t('common.unknown'))
                            })}
                        </span>
                    </div>
                {:else if expandedId !== expense.id}
                    <div transition:slideFade={{ y: 20, duration: 300 }}>
                        <div class="flex flex-wrap gap-x-2 text-xs text-muted-foreground dark:text-slate-400 transition-colors">
                                <span class="truncate">
                                    {$t('expense.list.paid_by')} 
                                    {#if currentUserId && expense.payer === currentUserId}
                                        <span class="font-bold text-indigo-600 dark:text-indigo-400">{$t('common.you')}</span>
                                    {:else}
                                        <span class="font-semibold text-slate-700 dark:text-slate-300">{expense.expand?.payer?.name || $t('common.unknown')}</span>
                                    {/if}
                                </span>
                                <span>•</span>
                                <span class="whitespace-nowrap">{$t('expense.list.for')} <span class="font-semibold text-slate-700 dark:text-slate-300">{expense.involved?.length || 0} p.</span></span>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
        <div class="font-bold text-lg text-slate-900 dark:text-slate-100 transition-colors text-right leading-none">
            {formatAmount(expense.amount, expense.currency || 'EUR')}
        </div>
    </div>

    <!-- Expanded Details & Actions -->
    {#if expandedId === expense.id}
        <div class="bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800" transition:slide={{ duration: 200 }}>
            <div class="p-4 space-y-4">
                {#if expense.is_reimbursement}
                    <!-- Simplified Layout for Reimbursements -->
                     <div class="text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
                        <span>Date</span>
                        <span class="font-medium text-slate-700 dark:text-slate-300">{new Date(expense.date).toLocaleDateString()}</span>
                    </div>

                    <button 
                        class="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95 shadow-sm"
                        onclick={(e) => { e.stopPropagation(); onRequestDelete(expense.id); }}
                    >
                        <Undo2 class="h-4 w-4" />
                        {$t('common.cancel')}
                    </button>
                    
                {:else}
                    <!-- Standard Layout -->
                    <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <div class="flex justify-between">
                            <span>Date:</span>
                            <span class="font-medium text-slate-700 dark:text-slate-300">{new Date(expense.date).toLocaleDateString()}</span>
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span>{$t('expense.list.paid_by')}:</span>
                            <div>
                                {#if currentUserId && expense.payer === currentUserId}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                        {$t('common.you')}
                                    </span>
                                {:else}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                        {expense.expand?.payer?.name || $t('common.unknown')}
                                    </span>
                                {/if}
                            </div>
                        </div>

                        <div class="flex justify-between items-center">
                            <span>{$t('expense.list.for')}:</span>
                            <div class="flex flex-wrap gap-1 justify-end">
                                {#if expense.expand?.involved}
                                    {#each expense.expand.involved as p (p.id)}
                                        {#if currentUserId && p.id === currentUserId}
                                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                {$t('common.you')}
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                                {p.name}
                                            </span>
                                        {/if}
                                    {/each}
                                {:else}
                                    <span class="text-slate-400 italic">No participants</span>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- Action Bar -->
                    <div class="grid grid-cols-3 gap-2">
                        <button 
                            disabled={offlineService.isOffline}
                            class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed {offlineService.isOffline ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}"
                            onclick={async (e) => { e.stopPropagation();   await goto(`/k/${kimpayId}/edit/${expense.id}`); }}
                            >
                            <Pencil class="h-4 w-4" />
                            {$t('common.edit')}
                        </button>

                        {#if expense.photos && expense.photos.length > 0}
                        <button 
                            disabled={offlineService.isOffline}
                            class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-medium text-sm transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed {offlineService.isOffline ? '' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}"
                            onclick={(e) => { e.stopPropagation(); onOpenGallery(expense); }}
                        >
                            <ImageIcon class="h-4 w-4" />
                            Photos
                        </button>
                        {:else}
                            <button disabled class="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 font-medium text-sm cursor-not-allowed">
                            <ImageIcon class="h-4 w-4" />
                            Photos
                            </button>
                        {/if}

                        <button 
                        disabled={offlineService.isOffline}
                        class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-medium text-sm transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed {offlineService.isOffline ? '' : 'hover:bg-red-50 dark:hover:bg-red-900/20'}"
                        onclick={(e) => { e.stopPropagation(); onRequestDelete(expense.id); }}
                        >
                        <Trash2 class="h-4 w-4" />
                        {$t('common.delete')}
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
  @keyframes slideUpFade {
    from {
      opacity: 0;
      transform: translateY(50px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .expense-item {
    animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
</style>
