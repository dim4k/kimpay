<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { calculateDebts, type Transaction } from '$lib/balance';
  import { LoaderCircle, ArrowRight, Wallet, CircleCheck } from "lucide-svelte";
  import { fade } from 'svelte/transition';

  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { t } from '$lib/i18n';
  import CountUp from '$lib/components/ui/CountUp.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import { expensesStore } from '$lib/stores/expenses.svelte';
  import { participantsStore } from '$lib/stores/participants.svelte';
  import { offlineService } from '$lib/services/offline.svelte';
  import { pb } from '$lib/pocketbase';

  let kimpayId = $derived(page.params.id ?? '');
  
  // Use stores
  let participants = $derived(participantsStore.list);
  let expenses = $derived(expensesStore.list);
  let myId = $derived(participantsStore.me?.id ?? null);
  
  // Reactive transactions calculation
  let transactions = $derived(calculateDebts(expenses, participants));
  
  let isLoading = $state(true);

  onMount(async () => {
      if (kimpayId) {
          // Layout inits, but logic here checks loading...
          if (!expensesStore.list.length || !participantsStore.list.length) {
              isLoading = true;
              await Promise.all([
                  expensesStore.init(kimpayId),
                  participantsStore.init(kimpayId)
              ]);
              isLoading = false;
          } else {
            isLoading = false;
          }
      }
  });

  function openSettleModal(tx: Transaction) {
      if (offlineService.isOffline) {
          modals.alert({
              message: $t('balance.reimbursement.offline_unavailable')
          });
          return;
      }

      modals.confirm({
          title: $t('balance.settle.modal.title'),
          description: $t('balance.settle.modal.desc', {
                amount: tx.amount.toFixed(2) + '€',
                from: tx.from === myId ? $t('common.you') : getName(tx.from),
                to: tx.to === myId ? $t('common.you') : getName(tx.to)
          }),
          confirmText: $t('balance.settle.confirm'),
          cancelText: $t('common.cancel'),
          onConfirm: async () => {
             await expensesStore.createReimbursement(tx.from, tx.to, tx.amount, $t('balance.reimbursement'), kimpayId, participants);
          }
      });
  }

  function getName(id: string) {
      return participants.find(p => p.id === id)?.name || $t('common.unknown');
  }

  function getAvatar(id: string) {
      const p = participants.find(p => p.id === id);
      return p?.avatar ? pb.files.getURL(p, p.avatar) : null;
  }
</script>

<main class="container p-4 space-y-6 bg-slate-50 dark:bg-background transition-colors">
    <header class="space-y-1">
        <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 w-fit">{$t('balance.title')}</h1>
        <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">{$t('balance.subtitle')}</p>
    </header>

    {#if isLoading}
        <div class="flex justify-center py-20">
            <LoaderCircle class="h-10 w-10 animate-spin text-indigo-500" />
        </div>
    {:else if expenses.length === 0}
         <div class="text-center py-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors animate-pop-in">
            <Wallet class="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p class="text-slate-500 font-medium dark:text-slate-400">{$t('balance.empty.title')}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">{$t('balance.empty.desc')}</p>
        </div>
    {:else}
        
        <!-- Transactions List or "Settled" Message -->
        {#if transactions.length === 0}
            <div class="animate-pop-in bg-gradient-to-br from-green-400 to-emerald-500 text-white p-8 rounded-3xl text-center shadow-lg shadow-green-200 mb-8">
                <CircleCheck class="h-16 w-16 mx-auto mb-4 text-white/90" />
                <p class="text-2xl font-bold">{$t('balance.settled.title')}</p>
                <p class="text-white/80 mt-2">{$t('balance.settled.desc')}</p>
            </div>
        {:else}
             <div class="space-y-3 mb-8">
                <h2 class="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1">{$t('balance.suggested.title')}</h2>
                
                <div class="space-y-3">
                    {#each transactions as tx, i (i)}
                        <button 
                            class="bg-card/90 backdrop-blur-md p-3 rounded-2xl shadow-sm border flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300 w-full text-left balance-item"  
                            style="animation-delay: {i * 50}ms;"
                            onclick={() => openSettleModal(tx)}
                            disabled={!myId} 
                        >
                            <!-- Highlight bar if involved -->
                            {#if tx.from === myId || tx.to === myId}
                                <div class="absolute left-0 top-0 bottom-0 w-1 {tx.from === myId ? 'bg-orange-500' : 'bg-green-500'}"></div>
                            {/if}

                            <div class="flex items-center gap-3 pl-2">
                                <Avatar name={getName(tx.from)} src={getAvatar(tx.from)} class="h-10 w-10 text-base shadow-md ring-2 ring-white dark:ring-slate-700" />
                                <div class="flex flex-col">
                                    <span class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight transition-colors">
                                        {tx.from === myId ? $t('common.you') : getName(tx.from)}
                                    </span>
                                    <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{$t('balance.payer')}</span>
                                </div>
                            </div>

                            <div class="flex flex-col items-center px-2 z-10">
                                 <span class="text-[10px] font-bold text-slate-400 mb-1">{$t('balance.pays')}</span>
                                 <div class="bg-slate-100 dark:bg-slate-800 rounded-full p-1 px-3 flex items-center gap-1 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    <span class="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{tx.amount.toFixed(2)}€</span>
                                    <ArrowRight class="h-3 w-3 text-slate-400 group-hover:text-indigo-500" />
                                 </div>
                            </div>

                            <div class="flex items-center gap-3 justify-end pr-1">
                                <div class="flex flex-col items-end">
                                    <span class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight transition-colors">
                                        {tx.to === myId ? $t('common.you') : getName(tx.to)}
                                    </span>
                                    <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{$t('balance.receiver')}</span>
                                </div>
                                 <Avatar name={getName(tx.to)} src={getAvatar(tx.to)} class="h-10 w-10 text-base shadow-md ring-2 ring-white dark:ring-slate-700" />
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- My Status (Always Visible) -->
        {#if myId}
            {@const myDebts = transactions.filter(tx => tx.from === myId)}
            {@const myCredit = transactions.filter(tx => tx.to === myId)}
            {@const totalDebit = myDebts.reduce((sum, tx) => sum + tx.amount, 0)}
            {@const totalCredit = myCredit.reduce((sum, tx) => sum + tx.amount, 0)}
            {@const netBalance = totalCredit - totalDebit}
            {@const totalExpenses = expenses.reduce((sum, e) => sum + (e.is_reimbursement ? 0 : (Number(e.amount)||0)), 0)}
            
            <div class="space-y-3" transition:fade>
                 <h2 class="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1">{$t('balance.your_summary')}</h2>
                 <div class="grid grid-cols-2 gap-3">
                    <!-- Block 1: Net Position -->
                    
                    {#if Math.abs(netBalance) < 0.01}
                        <!-- All Good State -->
                        <div class="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-4 rounded-3xl border border-green-100 dark:border-green-900/50 relative overflow-hidden transition-colors">
                            <div class="absolute -right-4 -top-4 bg-green-200/50 dark:bg-green-800/20 w-24 h-24 rounded-full blur-2xl"></div>
                            <span class="text-[10px] text-green-600 dark:text-green-400 font-bold tracking-wider relative z-10">{$t('balance.status')}</span>
                            <div class="text-xl font-black text-green-600/90 dark:text-green-400 mt-2 relative z-10 tracking-tight leading-tight">
                                {$t('balance.all_good')}
                            </div>
                        </div>
                    {:else if netBalance < 0}
                        <!-- You Owe State -->
                        <div class="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 p-4 rounded-3xl border border-orange-100 dark:border-orange-900/50 relative overflow-hidden transition-colors">
                            <div class="absolute -right-4 -top-4 bg-orange-200/50 dark:bg-orange-800/20 w-24 h-24 rounded-full blur-2xl"></div>
                            <span class="text-[10px] text-orange-600 dark:text-orange-400 font-bold tracking-wider relative z-10">{$t('balance.you_owe')}</span>
                            <div class="text-2xl font-black text-orange-600/90 dark:text-orange-400 mt-1 relative z-10 tracking-tight">
                                <CountUp value={Math.abs(netBalance)} /><span class="text-sm align-top opacity-60">€</span>
                            </div>
                        </div>
                    {:else}
                         <!-- Owed To You State -->
                         <div class="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/50 relative overflow-hidden transition-colors">
                            <div class="absolute -right-4 -top-4 bg-emerald-200/50 dark:bg-emerald-800/20 w-24 h-24 rounded-full blur-2xl"></div>
                            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tracking-wider relative z-10">{$t('balance.owed_to_you')}</span>
                            <div class="text-2xl font-black text-emerald-600/90 dark:text-emerald-400 mt-1 relative z-10 tracking-tight">
                                <CountUp value={netBalance} /><span class="text-sm align-top opacity-60">€</span>
                            </div>
                        </div>
                    {/if}

                     <!-- Block 2: Total Expenses -->
                     <div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-3xl border border-blue-100 dark:border-blue-900/50 relative overflow-hidden transition-colors">
                        <div class="absolute -right-4 -top-4 bg-blue-200/50 dark:bg-blue-800/20 w-24 h-24 rounded-full blur-2xl"></div>
                        <span class="text-[10px] text-blue-600 dark:text-blue-400 font-bold tracking-wider relative z-10">{$t('balance.total_group')}</span>
                        <div class="text-2xl font-black text-blue-600/90 dark:text-blue-400 mt-1 relative z-10 tracking-tight">
                            <CountUp value={totalExpenses} /><span class="text-sm align-top opacity-60">€</span>
                        </div>
                    </div>
                 </div>
            </div>
        {/if}

    {/if}
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

  .balance-item {
    animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
</style>
