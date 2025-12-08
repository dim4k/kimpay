<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Button } from "$lib/components/ui/button"; 
  import { pb } from '$lib/pocketbase';
  import { deleteExpense } from '$lib/api';
  import { onMount, getContext, onDestroy } from 'svelte';
  import { Pencil, Share2, Check, Trash2, Image as ImageIcon, Wallet } from "lucide-svelte"; 
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import PhotoGallery from '$lib/components/ui/PhotoGallery.svelte';

  import { t } from '$lib/i18n';
  
  let kimpayId = $derived($page.params.id ?? '');
  let expenses = $state<any[]>([]);
  let isLoading = $state(true);
  let kimpay = $state<any>({}); 
  let showTick = $state(false); 

  // Modal State
  let expenseToDelete = $state<string | null>(null);
  let isDeleting = $state(false);

  // Gallery State
  let galleryOpen = $state(false);
  let galleryPhotos = $state<string[]>([]);
  let galleryRecord = $state<any>(null);

  function openGallery(expense: any) {
      if (expense.photos && expense.photos.length > 0) {
          galleryPhotos = expense.photos;
          galleryRecord = expense;
          galleryOpen = true;
      }
  }

  async function loadExpenses() {
      try {
          // Fetch Kimpay with all related data (reverse expansion)
          const res = await pb.collection('kimpays').getOne(kimpayId, {
              expand: 'expenses_via_kimpay.payer,expenses_via_kimpay.involved,participants_via_kimpay'
          });
          
          kimpay = res;
          
          // Extract expenses and sort client-side (Db sort not available on expand)
          expenses = res.expand ? (res.expand['expenses_via_kimpay'] || []) : [];
          expenses.sort((a: any, b: any) => {
              const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
              if (dateDiff !== 0) return dateDiff;
              return new Date(b.created).getTime() - new Date(a.created).getTime();
          });

          // Extract participants for count/display
          const participants = res.expand ? (res.expand['participants_via_kimpay'] || []) : [];
          if (!kimpay.expand) kimpay.expand = {};
          kimpay.expand.participants = participants;

      } catch (e) {
          console.error(e);
          // If 404, maybe redirect?
      } finally {
          isLoading = false;
      }
  }

  function requestDelete(id: string) {
      expenseToDelete = id;
  }

  async function confirmDelete() {
      if (!expenseToDelete) return;
      isDeleting = true;
      try {
          await deleteExpense(expenseToDelete);
          await loadExpenses();
          expenseToDelete = null;
      } catch (e) {
          console.error("Failed to delete", e);
          alert("Failed to delete expense"); 
      } finally {
          isDeleting = false;
      }
  }

  async function copyLink() {
      try {
          await navigator.clipboard.writeText(window.location.href);
          showTick = true;
          setTimeout(() => showTick = false, 2000);
      } catch (err) {
          console.error('Failed to copy: ', err);
      }
  }

  
  let unsubscribe: () => void;

  async function initPage() {
      isLoading = true;
      
      // Cleanup previous subscription if any
      if (unsubscribe) {
          unsubscribe();
          unsubscribe = undefined!;
      }

      await loadExpenses();

      try {
        unsubscribe = await pb.collection('kimpays').subscribe(kimpayId, async ({ action, record }) => {
             if (action === 'update') {
                 await loadExpenses();
             }
        });
      } catch (e) {
        console.error("Failed to subscribe", e);
      }
  }

  $effect(() => {
      // Reactively run initPage when kimpayId changes
      if (kimpayId) {
          initPage();
      }
  });

  onDestroy(() => {
     if (unsubscribe) unsubscribe();
  });

  const refreshSignal = getContext<{ count: number }>('refreshSignal');
  $effect(() => {
    // This will run when refreshSignal.count changes (triggered by layout)
    if (refreshSignal && refreshSignal.count > 0) {
        loadExpenses();
    }
  });
</script>

<main class="container p-4 space-y-6">
  <!-- Kimpay Title Section -->
  <header class="space-y-1">
      <div class="flex items-center gap-3">
        {#if kimpay.icon}
            <div class="text-2xl filter drop-shadow-sm transform -translate-y-[1px]">
                {kimpay.icon}
            </div>
        {/if}
        <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            {kimpay.name || "Kimpay"}
        </h1>
      </div>
      <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">
          <span class="font-semibold text-slate-700 dark:text-slate-300">{expenses.length}</span> {$t('expense.list.items')}
          <span class="mx-1">•</span>
          <span class="font-semibold text-slate-700 dark:text-slate-300">{kimpay.expand?.participants?.length || 0}</span> {$t('settings.participants').toLowerCase()}
      </p>
  </header>

  <div class="flex flex-col gap-4">
    <!-- Expenses List -->
    {#if isLoading}
        <div class="text-center py-8 text-slate-500 dark:text-slate-400">{$t('common.loading')}</div>
    {:else if expenses.length === 0}

        <div class="text-center py-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors animate-pop-in">
           <Wallet class="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
           <p class="text-slate-500 font-medium dark:text-slate-400">{$t('expense.list.empty.title')}</p>
           <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">{$t('expense.list.empty.desc')}</p>
        </div>
    {:else}
        <div class="space-y-3">
            {#each expenses as expense, i (expense.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div 
                    class="expense-item flex justify-between items-center p-3 md:p-4 bg-card rounded-xl border shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors cursor-pointer"
                    style="animation-delay: {i * 50}ms;"
                    onclick={() => goto(`/k/${kimpayId}/edit/${expense.id}`)}
                >
                    <div class="flex items-center gap-3 md:gap-4 flex-1 min-w-0 mr-2">
                        <div class="h-9 w-9 md:h-10 md:w-10 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-lg md:text-xl border border-slate-100 dark:border-slate-700 transition-colors">
                             {expense.icon || '💸'}
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="font-medium text-slate-900 dark:text-slate-100 transition-colors truncate">
                                {expense.description}
                            </span>
                            <div class="flex flex-wrap gap-x-2 text-xs text-muted-foreground dark:text-slate-400 transition-colors">
                                <span class="truncate">{$t('expense.list.paid_by')} <span class="font-semibold text-slate-700 dark:text-slate-300">{expense.expand?.payer?.name || $t('common.unknown')}</span></span>
                                <span>•</span>
                                <span class="whitespace-nowrap">{$t('expense.list.for')} <span class="font-semibold text-slate-700 dark:text-slate-300">{expense.involved?.length || 0} p.</span></span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 md:gap-3 shrink-0">
                        <div class="font-bold text-base md:text-lg text-slate-900 dark:text-slate-100 transition-colors text-right leading-none">
                            {expense.amount.toFixed(2)} €
                        </div>
                        <div class="flex gap-1 transition-opacity">
                            {#if expense.photos && expense.photos.length > 0}
                                <button class="p-1.5 md:p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg" 
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        openGallery(expense);
                                    }}
                                >
                                    <ImageIcon class="h-4 w-4" />
                                </button>
                            {/if}
                            <div class="hidden md:flex gap-1">
                                <a href="/k/{kimpayId}/edit/{expense.id}" 
                                   class="p-1.5 md:p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg"
                                   onclick={(e) => e.stopPropagation()}
                                >
                                    <Pencil class="h-4 w-4" />
                                </a>
                                <button class="p-1.5 md:p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg" 
                                    onclick={(e) => {
                                        e.stopPropagation(); 
                                        requestDelete(expense.id);
                                    }}
                                >
                                    <Trash2 class="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
  </div>

  <ConfirmModal 
      isOpen={!!expenseToDelete}
      title={$t('modal.delete_expense.title')}
      description={$t('modal.delete_expense.desc')}
      confirmText={$t('modal.delete_expense.confirm')}
      variant="destructive"
      isProcessing={isDeleting}
      onConfirm={confirmDelete}
      onCancel={() => expenseToDelete = null}
  />
  
  <PhotoGallery 
      isOpen={galleryOpen}
      photos={galleryPhotos}
      record={galleryRecord}
      onClose={() => galleryOpen = false}
  />
</main>

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
