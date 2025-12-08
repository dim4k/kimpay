<script lang="ts">
  import { t } from '$lib/i18n';
  import { pb } from '$lib/pocketbase';
  import { modals } from '$lib/stores/modals';
  import { addParticipant } from '$lib/api';
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Check } from "lucide-svelte";
  import { onMount } from 'svelte';
  import { appState } from '$lib/state.svelte';
  import { invalidateAll } from '$app/navigation';
  
  let { isOpen } = $props();

  let identityState = $derived($modals.identity);
  let kimpayId = $derived(identityState?.kimpayId);
  
  let participants = $state<any[]>([]);
  let newParticipantName = $state("");
  let selectedParticipantId = $state<string | null>(null);

  // Sync with global state if available to show checkmark
  $effect(() => {
      if (appState.participant) {
          selectedParticipantId = appState.participant.id;
      } else {
        // Try local storage
        if (kimpayId) {
             const stored = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
             selectedParticipantId = stored[kimpayId] || localStorage.getItem(`kimpay_user_${kimpayId}`);
        }
      }
  });

  // Load participants from options or appState
  $effect(() => {
      if (isOpen) {
          if (identityState?.participants && identityState.participants.length > 0) {
              participants = identityState.participants;
          } else if (appState.participants.length > 0 && appState.kimpay?.id === kimpayId) {
              participants = appState.participants;
          } else {
              // Fallback: If not passed and not in appState, we must fetch via kimpay expand
              // We cannot list participants directly (403).
              fetchParticipantsViaKimpay();
          }
      }
  });

  async function fetchParticipantsViaKimpay() {
      if (!kimpayId) return;
      try {
           const k = await pb.collection('kimpays').getOne(kimpayId, {
               expand: 'participants_via_kimpay'
           });
           participants = k.expand?.participants_via_kimpay || [];
      } catch (e) {
          console.error("Failed to fetch participants via kimpay", e);
      }
  }

  function selectParticipant(participantId: string) {
      if (!kimpayId) return;

      localStorage.setItem(`kimpay_user_${kimpayId}`, participantId);
      
      const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
      myKimpays[kimpayId] = participantId;
      localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));
      
      selectedParticipantId = participantId;

      // Update global state
      appState.init(kimpayId, true).then(async () => {
           if (identityState?.onSelect) {
               identityState.onSelect();
           } else {
               await invalidateAll();
           }
           modals.closeIdentity();
      });
  }

  async function createAndSelectParticipant() {
      if (!newParticipantName.trim() || !kimpayId) return;
      try {
          const newP = await addParticipant(kimpayId, newParticipantName);
          selectParticipant(newP.id);
      } catch (e) {
          console.error("Failed to add participant", e);
          alert("Failed to create participant");
      }
  }
</script>

{#if isOpen && identityState}
    <div class="fixed inset-0 z-[60] bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div class="p-6 pb-2 relative">
                 <button 
                    onclick={modals.closeIdentity}
                    class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                    ✕
                </button>
                <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">{$t('identity.title')}</h2>
                <p class="text-slate-500 dark:text-slate-400 text-sm">{$t('identity.subtitle')}</p>
            </div>
            
            <div class="flex-1 overflow-y-auto p-4 space-y-2">
                {#each participants as p}
                    <button 
                        class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-transparent hover:border-indigo-100 dark:hover:border-slate-700 transition-all text-left group {selectedParticipantId === p.id ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : ''}"
                        onclick={() => selectParticipant(p.id)}
                    >
                        <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold overflow-hidden">
                             <!-- Future: Avatar rendering -->
                            {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span class="font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
                        {#if selectedParticipantId === p.id}
                            <div class="ml-auto text-indigo-600">
                                <Check class="h-5 w-5" />
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>

            <div class="p-4 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div class="flex gap-2">
                    <Input 
                        placeholder={$t('identity.new_name_placeholder')} 
                        bind:value={newParticipantName}
                        maxlength={15}
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
