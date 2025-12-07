<script lang="ts">
  import { page } from '$app/stores';
  import { pb } from '$lib/pocketbase';
  import { onMount } from 'svelte';
  import { calculateDebts, type Transaction } from '$lib/balance';
  import { Loader2, ArrowRight, Wallet, CheckCircle } from "lucide-svelte";
  import { fade, fly } from 'svelte/transition';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { createReimbursement } from '$lib/api';
  import { t } from '$lib/i18n';

  let kimpayId = $derived($page.params.id);
  let isLoading = $state(true);
  let participants = $state<any[]>([]);
  let expenses = $state<any[]>([]);
  let transactions = $state<Transaction[]>([]);
  let myId = $state<string | null>(null);

  // Modal State
  let selectedTransaction = $state<Transaction | null>(null);
  let isProcessing = $state(false);

  async function loadBalance() {
    isLoading = true;
    try {
      const res = await pb.collection('kimpays').getOne(kimpayId, {
          expand: 'expenses_via_kimpay.payer,expenses_via_kimpay.involved,participants_via_kimpay'
      });

      participants = res.expand ? (res.expand['participants_via_kimpay'] || []) : [];
      expenses = res.expand ? (res.expand['expenses_via_kimpay'] || []) : [];

      const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
      if (myKimpays[kimpayId]) {
          myId = myKimpays[kimpayId];
      }

      transactions = calculateDebts(expenses, participants);

    } catch (e) {
      console.error("Failed to load balance", e);
    } finally {
        isLoading = false;
    }
  }

  onMount(loadBalance);

  async function handleSettle() {
      if (!selectedTransaction) return;
      isProcessing = true;
      try {
          await createReimbursement(
              kimpayId, 
              selectedTransaction.from, 
              selectedTransaction.to, 
              selectedTransaction.amount
          );
          selectedTransaction = null;
          await loadBalance(); // Refresh
      } catch (e) {
          console.error(e);
          alert("Failed to settle debt");
      } finally {
          isProcessing = false;
      }
  }

  function getName(id: string) {
      return participants.find(p => p.id === id)?.name || $t('common.unknown');
  }
</script>

<main class="container p-4 pb-24 space-y-6 bg-slate-50 dark:bg-background transition-colors">
    <header class="space-y-1">
        <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{$t('balance.title')}</h1>
        <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">{$t('balance.subtitle')}</p>
    </header>

    {#if isLoading}
        <div class="flex justify-center py-20">
            <Loader2 class="h-10 w-10 animate-spin text-indigo-500" />
        </div>
    {:else if expenses.length === 0}
         <div class="text-center py-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
            <Wallet class="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p class="text-slate-500 font-medium dark:text-slate-400">{$t('balance.empty.title')}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">{$t('balance.empty.desc')}</p>
        </div>
    {:else}
        
        {#if transactions.length === 0}
            <div class="bg-gradient-to-br from-green-400 to-emerald-500 text-white p-8 rounded-3xl text-center shadow-lg shadow-green-200" transition:fly={{ y: 20 }}>
                <CheckCircle class="h-16 w-16 mx-auto mb-4 text-white/90" />
                <p class="text-2xl font-bold">{$t('balance.settled.title')}</p>
                <p class="text-white/80 mt-2">{$t('balance.settled.desc')}</p>
            </div>
        {:else}
             <div class="space-y-3">
                <h2 class="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1">{$t('balance.suggested.title')}</h2>
                
                <div class="space-y-3">
                    {#each transactions as tx, i}
                        <button 
                            class="bg-card/90 backdrop-blur-md p-3 rounded-2xl shadow-sm border flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300 w-full text-left"  
                            in:fly={{ y: 20, delay: i * 50 }}
                            onclick={() => selectedTransaction = tx}
                            disabled={!myId} 
                        >
                            <!-- Highlight bar if involved -->
                            {#if tx.from === myId || tx.to === myId}
                                <div class="absolute left-0 top-0 bottom-0 w-1 {tx.from === myId ? 'bg-orange-500' : 'bg-green-500'}"></div>
                            {/if}

                            <div class="flex items-center gap-3 pl-2">
                                <Avatar name={getName(tx.from)} class="h-10 w-10 text-base shadow-md ring-2 ring-white dark:ring-slate-700" />
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
                                 <Avatar name={getName(tx.to)} class="h-10 w-10 text-base shadow-md ring-2 ring-white dark:ring-slate-700" />
                            </div>
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Reimbursement Modal -->
            {#if selectedTransaction}
                <div 
                    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" 
                    transition:fade 
                    onclick={() => selectedTransaction = null}
                    onkeydown={(e) => e.key === 'Escape' && (selectedTransaction = null)}
                    role="button"
                    tabindex="0"
                >
                    <div 
                        class="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-6 border transition-colors" 
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => e.stopPropagation()}
                        role="button"
                        tabindex="0"
                    >
                        <div class="text-center space-y-2">
                             <div class="w-16 h-16 bg-indigo-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                                <CheckCircle class="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                             </div>
                             <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100 transition-colors">{$t('balance.settle.modal.title')}</h3>
                             <p class="text-muted-foreground dark:text-slate-400 transition-colors">
                                {$t('balance.settle.modal.desc', {
                                    amount: selectedTransaction.amount.toFixed(2) + '€',
                                    from: selectedTransaction.from === myId ? $t('common.you') : getName(selectedTransaction.from),
                                    to: selectedTransaction.to === myId ? $t('common.you') : getName(selectedTransaction.to)
                                })}
                             </p>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3">
                            <button 
                                class="py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                                onclick={() => selectedTransaction = null}
                            >
                                {$t('common.cancel')}
                            </button>
                            <button 
                                class="py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                onclick={handleSettle}
                                disabled={isProcessing}
                            >
                                {#if isProcessing}
                                    <Loader2 class="h-4 w-4 animate-spin" />
                                    {$t('common.loading')}
                                {:else}
                                    {$t('balance.settle.confirm')}
                                {/if}
                            </button>
                        </div>
                    </div>
                </div>
            {/if}


            <!-- My Status -->
            {#if myId}
                {@const myDebts = transactions.filter(tx => tx.from === myId)}
                {@const myCredit = transactions.filter(tx => tx.to === myId)}
                
                <div class="mt-8 space-y-3" transition:fade>
                     <h2 class="text-xs font-bold uppercase tracking-widest text-slate-400 pl-1">{$t('balance.your_summary')}</h2>
                     <div class="grid grid-cols-2 gap-3">
                        <div class="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 p-4 rounded-3xl border border-orange-100 dark:border-orange-900/50 relative overflow-hidden transition-colors">
                            <div class="absolute -right-4 -top-4 bg-orange-200/50 dark:bg-orange-800/20 w-24 h-24 rounded-full blur-2xl"></div>
                            <span class="text-[10px] text-orange-600 dark:text-orange-400 font-bold tracking-wider relative z-10">{$t('balance.you_owe')}</span>
                            <div class="text-2xl font-black text-orange-600/90 dark:text-orange-400 mt-1 relative z-10 tracking-tight">
                                {myDebts.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}<span class="text-sm align-top opacity-60">€</span>
                            </div>
                        </div>
                         <div class="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/50 relative overflow-hidden transition-colors">
                            <div class="absolute -right-4 -top-4 bg-emerald-200/50 dark:bg-emerald-800/20 w-24 h-24 rounded-full blur-2xl"></div>
                            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tracking-wider relative z-10">{$t('balance.owed_to_you')}</span>
                            <div class="text-2xl font-black text-emerald-600/90 dark:text-emerald-400 mt-1 relative z-10 tracking-tight">
                                {myCredit.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}<span class="text-sm align-top opacity-60">€</span>
                            </div>
                        </div>
                     </div>
                </div>
            {/if}

        {/if}

    {/if}
</main>
