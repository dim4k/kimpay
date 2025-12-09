<script lang="ts">
    import { Pencil, Trash2, Image as ImageIcon, Camera } from "lucide-svelte";
    import { t } from '$lib/i18n';
    import { slide } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { cubicOut } from 'svelte/easing';

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
    /* eslint-disable svelte/no-navigation-without-resolve */
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
    class="expense-item bg-card rounded-xl border shadow-sm overflow-hidden group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all duration-300"
    class:ring-2={expandedId === expense.id}
    class:ring-indigo-500={expandedId === expense.id}
    class:dark:ring-indigo-400={expandedId === expense.id}
    {style}
>
    <!-- Main Row (Always Visible) -->
    <div 
        class="flex justify-between items-center p-4 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
        onclick={() => onToggleExpand(expense.id)}
    >
        <div class="flex items-center gap-4 flex-1 min-w-0 mr-2">
            <div class="h-10 w-10 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-xl border border-slate-100 dark:border-slate-700 transition-colors relative">
                    {expense.icon || '💸'}
                    <!-- Camera indicator if collapsed -->
                    {#if (!expandedId || expandedId !== expense.id) && expense.photos && expense.photos.length > 0}
                    <div class="absolute -top-1.5 -right-1.5 h-5 w-5 bg-indigo-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                        <Camera class="h-2.5 w-2.5 text-white" />
                    </div>
                    {/if}
            </div>
            <div class="flex flex-col min-w-0">
                <span class="font-medium text-slate-900 dark:text-slate-100 transition-colors truncate text-base">
                    {expense.description}
                </span>
                {#if expandedId !== expense.id}
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
            {expense.amount.toFixed(2)} €
        </div>
    </div>

    <!-- Expanded Details & Actions -->
    {#if expandedId === expense.id}
        <div class="bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800" transition:slide={{ duration: 200 }}>
            <div class="p-4 space-y-4">
                <!-- Details -->
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
                        {#if expense.is_reimbursement}
                            <button 
                            class="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 font-medium text-sm cursor-not-allowed"
                            disabled
                            title="Reimbursements cannot be edited"
                            >
                            <Pencil class="h-4 w-4" />
                            {$t('common.edit')}
                            </button>
                        {:else}
                            <button 
                            class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors active:scale-95"
                            onclick={async (e) => { e.stopPropagation();   await goto(`/k/${kimpayId}/edit/${expense.id}`); }}
                            >
                            <Pencil class="h-4 w-4" />
                            {$t('common.edit')}
                            </button>
                        {/if}

                        {#if expense.photos && expense.photos.length > 0}
                        <button 
                            class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-medium text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors active:scale-95"
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
                        class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95"
                        onclick={(e) => { e.stopPropagation(); onRequestDelete(expense.id); }}
                        >
                        <Trash2 class="h-4 w-4" />
                        {$t('common.delete')}
                        </button>
                </div>
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
