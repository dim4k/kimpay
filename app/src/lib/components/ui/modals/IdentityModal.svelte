<script lang="ts">
  import { t } from '#lib/i18n.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { Input } from "#lib/components/ui/input/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import { Check, ChevronRight } from "@lucide/svelte";
  import { activeKimpayGlobal } from '#lib/stores/activeKimpayGlobal.svelte.js';
  import type { Participant } from '#lib/types.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { participantService } from '#lib/services/participant.js';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import Modal from './Modal.svelte';
  import ModalHeader from './ModalHeader.svelte';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import { NAME_MAX_LENGTH } from '#lib/constants.js';
  import { findSimilarName } from '#lib/utils/names.js';
  
  let { isOpen }: { isOpen: boolean } = $props();

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
  let createError = $state("");

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

  // Typing a name already in the list ("pierre" for "Pierre M."): most
  // likely that person, added by someone else.
  let similar = $derived(newParticipantName.trim() ? findSimilarName(newParticipantName, selectableParticipants) : null);

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
      createError = "";
      try {
          const participant = await activeKimpay.addParticipant(newParticipantName.trim());
          await selectParticipant(participant.id);
      } catch (e) {
          console.error("Failed to add participant", e);
          createError = getErrorMessage(e, $t);
      }
  }
</script>

{#if identityState}
<Modal 
    {isOpen} 
    onClose={activeKimpayGlobal.myParticipant ? () => modals.closeIdentity() : undefined}
    class="flex max-h-[90vh] max-w-md flex-col space-y-0 overflow-hidden p-0"
    backdropClass="bg-background/95"
    label={$t('identity.title')}
>
    <div class="p-6 pb-2">
        <ModalHeader
            title={$t('identity.title')}
            description={$t('identity.subtitle')}
            align="start"
            onClose={activeKimpayGlobal.myParticipant ? () => modals.closeIdentity() : undefined}
        />
    </div>
    
    <div class="flex-1 overflow-y-auto p-4 space-y-2">
        {#each selectableParticipants as p (p.id)}
            <button 
                class="flex w-full min-h-14 items-center gap-3 rounded-control border px-3 py-2 text-left transition-colors hover:bg-muted {selectedParticipantId === p.id ? 'border-primary bg-primary-soft' : ''}"
                onclick={() => selectParticipant(p.id)}
            >
                <Avatar name={p.name} record={p} class="w-10 h-10 text-sm" />
                <span class="flex-1 truncate text-base font-medium">{p.name}</span>
                {#if selectedParticipantId === p.id}
                    <Check class="h-5 w-5 text-primary" />
                {:else}
                    <ChevronRight class="h-4 w-4 text-muted-foreground" />
                {/if}
            </button>
        {/each}
    </div>

    <div class="space-y-2 border-t bg-muted/40 p-4">
        <Label for="identity-new">{$t('identity.new_label')}</Label>
        <div class="flex gap-2">
            <Input 
                placeholder={$t('identity.new_name_placeholder')} 
                bind:value={newParticipantName}
                maxlength={NAME_MAX_LENGTH}
                id="identity-new"
                onkeydown={(e) => e.key === 'Enter' && createAndSelectParticipant()}
            />
            <Button onclick={createAndSelectParticipant} disabled={!newParticipantName.trim()}>
                {$t('identity.create_button')}
            </Button>
        </div>
        {#if similar}
            <div class="flex items-center gap-2 rounded-control bg-primary-soft py-1 pl-3 pr-1 text-sm" role="status">
                <span class="min-w-0 flex-1">{$t('identity.similar', { name: similar.name })}</span>
                <Button size="sm" onclick={() => selectParticipant(similar!.id)}>{$t('identity.similar_yes')}</Button>
            </div>
        {/if}
        <FieldError message={createError} />
    </div>
</Modal>
{/if}
