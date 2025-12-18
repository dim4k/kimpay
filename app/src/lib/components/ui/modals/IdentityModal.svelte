<script lang="ts">
  import { t } from '$lib/i18n';
  import { pb } from '$lib/pocketbase';
  import { modals } from '$lib/stores/modals.svelte';
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Check } from "lucide-svelte";
  import { activeKimpayGlobal } from '$lib/stores/activeKimpayGlobal.svelte';
  import type { Participant } from '$lib/types';
  import { storageService } from '$lib/services/storage';
  import { auth } from '$lib/stores/auth.svelte';
  import { participantService } from '$lib/services/participant';
  import { myKimpays } from '$lib/stores/myKimpays.svelte';
  import Modal from './Modal.svelte';
  
  let { isOpen } = $props();

  let identityState = $derived(modals.identityState);
  let kimpayId = $derived(identityState?.kimpayId);
  
  let participants = $state<Participant[]>([]);
  let newParticipantName = $state("");
  let selectedParticipantId = $state<string | null>(null);

  // Filter out participants already linked to a User (unless it's the current logged-in user)
  let selectableParticipants = $derived(
    participants.filter(p => {
      // If participant has no user linked, it's selectable
      if (!p.user) return true;
      // If participant is linked to the current logged-in user, it's selectable by that user
      if (auth.user && p.user === auth.user.id) return true;
      // Otherwise, someone else owns this participant - hide it
      return false;
    })
  );

  // Sync with global state if available to show checkmark
  $effect(() => {
      if (activeKimpayGlobal.myParticipant) {
          selectedParticipantId = activeKimpayGlobal.myParticipant.id;
      } else {
        // Try local storage
        if (kimpayId) {
             selectedParticipantId = storageService.getMyParticipantId(kimpayId);
        }
      }
  });

  // Load participants from options or store
  $effect(() => {
      if (isOpen) {
          const globalKimpay = activeKimpayGlobal.kimpay;
          if (identityState?.participants && identityState.participants.length > 0) {
              participants = identityState.participants;
          } else if (globalKimpay && globalKimpay.id === kimpayId && globalKimpay.expand?.participants_via_kimpay) {
              // Ensure we are looking at the right kimpay's participants
              participants = globalKimpay.expand.participants_via_kimpay;
          } else {
              // Fallback: If not passed and not in store, we must fetch via kimpay expand
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

  async function selectParticipant(participantId: string) {
      if (!kimpayId) return;

      storageService.setMyParticipantId(kimpayId, participantId);
      
      selectedParticipantId = participantId;

      // If user is logged in, auto-claim this participant
      if (auth.user) {
          try {
              await participantService.claim(participantId, kimpayId, auth.user.id);
              myKimpays.load(true); // Refresh My Kimpays list
          } catch (e) {
              console.error("Failed to auto-claim participant", e);
          }
      }

      if (identityState?.onSelect) {
           identityState.onSelect();
      } else {
           window.location.reload();
      }
      modals.closeIdentity();
  }

  async function createAndSelectParticipant() {
      if (!newParticipantName.trim() || !kimpayId) return;
      try {
          const record = await pb.collection('participants').create({
              name: newParticipantName,
              kimpay: kimpayId
          });
          
          await selectParticipant(record.id);
      } catch (e) {
          console.error("Failed to add participant", e);
          modals.alert({ message: "Failed to create participant", title: "Error" });
      }
  }
</script>

{#if identityState}
<Modal 
    {isOpen} 
    onClose={activeKimpayGlobal.myParticipant ? () => modals.closeIdentity() : undefined}
    class="max-w-md max-h-[90vh] flex flex-col overflow-hidden p-0 space-y-0 rounded-2xl"
    backdropClass="bg-slate-50/95 dark:bg-slate-950/95"
>
    <div class="p-6 pb-2 relative">
            {#if activeKimpayGlobal.myParticipant}
            <button 
            onclick={() => modals.closeIdentity()}
            class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 z-10"
            title="Close"
        >
            ✕
        </button>
        {/if}
        <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">{$t('identity.title')}</h2>
        <p class="text-slate-500 dark:text-slate-400 text-sm">{$t('identity.subtitle')}</p>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4 space-y-2">
        {#each selectableParticipants as p (p.id)}
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
</Modal>
{/if}
