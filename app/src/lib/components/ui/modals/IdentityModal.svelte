<script lang="ts">
  import { t } from '$lib/i18n';
  import { modals } from '$lib/stores/modals.svelte';
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Check } from "@lucide/svelte";
  import { activeKimpayGlobal } from '$lib/stores/activeKimpayGlobal.svelte';
  import type { Participant } from '$lib/types';
  import { getErrorMessage } from '$lib/utils/errors';
  import { auth } from '$lib/stores/auth.svelte';
  import { participantService } from '$lib/services/participant';
  import { recentsStore } from '$lib/stores/recents.svelte';
  import Modal from './Modal.svelte';
  
  let { isOpen } = $props();

  let identityState = $derived(modals.identityState);
  let kimpayId = $derived(identityState?.kimpayId);

  // The modal is only opened from inside a Kimpay: read the live, reactive
  // participants of the active instance (no extra fetch needed).
  let activeKimpay = $derived(
    activeKimpayGlobal.instance?.id === kimpayId ? activeKimpayGlobal.instance : null
  );
  let participants = $derived<Participant[]>(activeKimpay?.participants ?? []);
  let selectedParticipantId = $derived(activeKimpay?.myParticipantId ?? null);
  let newParticipantName = $state("");

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

  async function selectParticipant(participantId: string) {
      if (!activeKimpay || !kimpayId) return;

      // The store is reactive: every view picks the new identity up at once.
      await activeKimpay.setMyParticipant(participantId);
      modals.closeIdentity();

      // If user is logged in, auto-claim this participant
      if (auth.user) {
          try {
              await participantService.claim(participantId, kimpayId, auth.user.id);
              recentsStore.init(true); // Refresh My Kimpays list
          } catch (e) {
              console.error("Failed to auto-claim participant", e);
          }
      }
  }

  async function createAndSelectParticipant() {
      if (!activeKimpay || !newParticipantName.trim()) return;
      try {
          const participant = await activeKimpay.addParticipant(newParticipantName.trim());
          await selectParticipant(participant.id);
      } catch (e) {
          console.error("Failed to add participant", e);
          modals.alert({ message: getErrorMessage(e, $t), variant: 'error' });
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
        <h2 class="text-2xl font-bold text-gradient-brand mb-2">{$t('identity.title')}</h2>
        <p class="text-slate-500 dark:text-slate-400 text-sm">{$t('identity.subtitle')}</p>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4 space-y-2">
        {#each selectableParticipants as p (p.id)}
            <button 
                class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted dark:hover:bg-slate-800 border-2 border-transparent hover:border-primary/20 dark:hover:border-slate-700 transition-all text-left group {selectedParticipantId === p.id ? 'bg-secondary border-primary/30' : ''}"
                onclick={() => selectParticipant(p.id)}
            >
                <div class="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold overflow-hidden">
                        <!-- Future: Avatar rendering -->
                    {p.name.slice(0, 2).toUpperCase()}
                </div>
                <span class="font-medium text-foreground">{p.name}</span>
                {#if selectedParticipantId === p.id}
                    <div class="ml-auto text-primary">
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
