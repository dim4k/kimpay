<script lang="ts">
  import { page } from '$app/stores';
  import { House, ChartPie, Settings, Plus, Share2, UserPlus, Check } from "lucide-svelte";
  import { t } from '$lib/i18n';
  import { onMount } from 'svelte';
  import { pb } from '$lib/pocketbase';
  import { addParticipant } from '$lib/api';
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";

  let { children } = $props();

  let kimpayId = $derived($page.params.id);
  let showIdentityModal = $state(false);
  let participants = $state<any[]>([]);
  let newParticipantName = $state("");
  let isLoadingParticipants = $state(false);
  
  async function checkIdentity() {
      if (!kimpayId) return;
      
      const storedUser = localStorage.getItem(`kimpay_user_${kimpayId}`);
      if (!storedUser) {
          showIdentityModal = true;
          loadParticipants();
      } else {
          showIdentityModal = false;
      }
  }

  async function loadParticipants() {
      isLoadingParticipants = true;
      try {
          participants = await pb.collection('participants').getFullList({
              filter: `kimpay="${kimpayId}"`
          });
      } catch (e) {
          console.error("Failed to load participants", e);
      } finally {
          isLoadingParticipants = false;
      }
  }

  function selectParticipant(participantId: string) {
      localStorage.setItem(`kimpay_user_${kimpayId}`, participantId);
      
      // Update my_kimpays list for home screen
      const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
      myKimpays[kimpayId] = participantId;
      localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));

      showIdentityModal = false;
  }

  async function createAndSelectParticipant() {
      if (!newParticipantName.trim()) return;
      try {
          const newP = await addParticipant(kimpayId, newParticipantName);
          selectParticipant(newP.id);
          participants = [...participants, newP]; // Optimistic update if needed
      } catch (e) {
          console.error("Failed to add participant", e);
          alert("Failed to create participant");
      }
  }

  $effect(() => {
    if (kimpayId) checkIdentity();
  });
</script>

<div class="flex-1 bg-slate-50 dark:bg-background pb-20 transition-colors"> <!-- pb-20 for bottom nav -->
  {@render children()}
</div>


<div class="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
    <!-- Navigation Bar -->
    <nav class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800 shadow-2xl safe-area-pb pointer-events-auto relative z-40 transition-colors">
        <div class="grid grid-cols-5 h-[4.5rem] items-end pb-2">
            
            <!-- Expenses (Home) -->
            <a 
                href="/k/{$page.params.id}" 
                class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {$page.url.pathname.endsWith($page.params.id) ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
            >
                <div class="relative">
                    <House class="h-6 w-6" strokeWidth={$page.url.pathname.endsWith($page.params.id) ? 2.5 : 2} />
                    {#if $page.url.pathname.endsWith($page.params.id)}
                         <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    {/if}
                </div>
                <span class="text-[10px] font-medium tracking-wide">{$t('nav.expenses')}</span>
            </a>

            <!-- Balance -->
            <a 
                href="/k/{$page.params.id}/balance" 
                class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {$page.url.pathname.includes('/balance') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
            >
                <div class="relative">
                     <ChartPie class="h-6 w-6" strokeWidth={$page.url.pathname.includes('/balance') ? 2.5 : 2} />
                     {#if $page.url.pathname.includes('/balance')}
                         <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    {/if}
                </div>
                <span class="text-[10px] font-medium tracking-wide">{$t('nav.balance')}</span>
            </a>

            <!-- Spacer for FAB (Center) -->
            <div class="pointer-events-none"></div>

            <!-- Share (New) -->
            <a 
                href="/k/{$page.params.id}/share" 
                class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {$page.url.pathname.includes('/share') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
            >
                <div class="relative">
                     <Share2 class="h-6 w-6" strokeWidth={$page.url.pathname.includes('/share') ? 2.5 : 2} />
                     {#if $page.url.pathname.includes('/share')}
                         <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    {/if}
                </div>
                <span class="text-[10px] font-medium tracking-wide">{$t('nav.share')}</span>
            </a>

            <!-- Settings -->
            <a 
                href="/k/{$page.params.id}/settings" 
                class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {$page.url.pathname.includes('/settings') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
            >
                <div class="relative">
                     <Settings class="h-6 w-6" strokeWidth={$page.url.pathname.includes('/settings') ? 2.5 : 2} />
                     {#if $page.url.pathname.includes('/settings')}
                         <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    {/if}
                </div>
                <span class="text-[10px] font-medium tracking-wide">{$t('nav.settings')}</span>
            </a>
        </div>
    </nav>
    

    <!-- Floating Action Button Container (Centered - Mounted LAST to stay on top visually if same z-index, but we use z-50) -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-50">
        <a 
            href="/k/{$page.params.id}/add" 
            class="flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-full h-16 w-16 shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 transition-transform duration-200 ring-4 ring-slate-50 dark:ring-slate-950"
        >
            <Plus class="h-8 w-8" strokeWidth={2.5} />
        </a>
    </div>
</div>

{#if showIdentityModal}
    <div class="fixed inset-0 z-[60] bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div class="p-6 pb-2">
                <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">{$t('identity.title')}</h2>
                <p class="text-slate-500 dark:text-slate-400 text-sm">{$t('identity.subtitle')}</p>
            </div>
            
            <div class="flex-1 overflow-y-auto p-4 space-y-2">
                 {#if isLoadingParticipants}
                    <div class="text-center py-4 text-slate-400">Loading...</div>
                 {:else}
                    {#each participants as p}
                        <button 
                            class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-transparent hover:border-indigo-100 dark:hover:border-slate-700 transition-all text-left group"
                            onclick={() => selectParticipant(p.id)}
                        >
                            <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                                {p.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span class="font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
                            <div class="ml-auto opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity">
                                <Check class="h-5 w-5" />
                            </div>
                        </button>
                    {/each}
                 {/if}
            </div>

            <div class="p-4 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div class="flex gap-2">
                    <Input 
                        placeholder={$t('identity.new_name_placeholder')} 
                        bind:value={newParticipantName}
                        class="dark:bg-slate-800 dark:border-slate-700"
                    />
                    <Button onclick={createAndSelectParticipant} disabled={!newParticipantName.trim()}>
                        {$t('identity.create_button')}
                    </Button>
                </div>
            </div>
        </div>
    </div>
{/if}
