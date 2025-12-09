<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Button } from "$lib/components/ui/button"; 
  import { pb } from '$lib/pocketbase';
  import { deleteExpense } from '$lib/api';
  import { onMount, getContext, onDestroy } from 'svelte';
  import { Wallet } from "lucide-svelte"; 
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import { modals } from '$lib/stores/modals';
  import { t } from '$lib/i18n';
  import ExpenseItem from '$lib/components/expense/ExpenseItem.svelte';
  
  let kimpayId = $derived($page.params.id ?? '');
  let expenses = $state<any[]>([]);
  let isLoading = $state(true);
  let kimpay = $state<any>({}); 
  let showTick = $state(false); 

  // Modal State
  let expenseToDelete = $state<string | null>(null);
  let isDeleting = $state(false);

  // Accordion State
  let expandedId = $state<string | null>(null);

  function toggleExpand(id: string) {
      if (expandedId === id) {
          expandedId = null;
      } else {
          expandedId = id;
      }
  }

  function openGallery(expense: any) {
      if (expense.photos && expense.photos.length > 0) {
          modals.gallery({
              photos: expense.photos,
              record: expense
          });
      }
  }

  async function loadExpenses() {
      try {
          // Fetch Kimpay with all related data (reverse expansion)
          const res = await pb.collection('kimpays').getOne(kimpayId, {
              expand: 'expenses_via_kimpay.payer,expenses_via_kimpay.involved,participants_via_kimpay',
              requestKey: null
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

  let currentUserId = $state<string | null>(null);

  $effect(() => {
    if (kimpayId) {
        // Read user ID from storage
        const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
        currentUserId = myKimpays[kimpayId] || localStorage.getItem(`kimpay_user_${kimpayId}`);
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
        // Re-read user ID in case it changed (e.g. identify modal)
        const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
        currentUserId = myKimpays[kimpayId] || localStorage.getItem(`kimpay_user_${kimpayId}`);
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
                <ExpenseItem 
                    {expense}
                    {currentUserId}
                    {expandedId}
                    {kimpayId}
                    onToggleExpand={() => toggleExpand(expense.id)}
                    onRequestDelete={() => requestDelete(expense.id)}
                    onOpenGallery={() => openGallery(expense)}
                    style="animation-delay: {i * 50}ms;"
                />
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
</main>
