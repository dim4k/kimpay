<script lang="ts">
  import { ChevronRight, UserPlus } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { profileMenu } from '#lib/stores/profileMenu.svelte.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { NAME_MAX_LENGTH } from '#lib/constants.js';
  import type { Participant } from '#lib/types.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import Badge from '#lib/components/ui/Badge.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import InviteSheet from '#lib/components/members/InviteSheet.svelte';
  import MemberSheet from '#lib/components/members/MemberSheet.svelte';

  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpay = $derived(activeKimpay?.kimpay);
  let participants = $derived(activeKimpay?.participants || []);
  let currentParticipantId = $derived(activeKimpay?.myParticipantId ?? null);
  let isLoading = $derived(activeKimpay?.loading ?? true);

  // The link opening the group (this page's URL, without the tab).
  let inviteLink = $derived(activeKimpay?.id ? `${window.location.origin}/k/${activeKimpay.id}` : '');
  let isInviteOpen = $state(false);

  // Someone who paid or shares an expense cannot be removed: no delete
  // button for them (instead of a refusal after the tap).
  let usedIds = $derived.by(() => {
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const ids = new Set<string>();
      for (const e of activeKimpay?.expenses ?? []) {
          ids.add(e.payer);
          e.involved?.forEach((id) => ids.add(id));
      }
      return ids;
  });

  let newParticipantName = $state("");
  // The member whose sheet is open (rename, merge, delete).
  let openedId = $state<string | null>(null);
  let opened = $derived(participants.find((p) => p.id === openedId) ?? null);

  // Shown at once (optimistic): the field is free for the next name right
  // away, and gets the name back if it could not be added.
  async function handleAddParticipant() {
      const name = newParticipantName.trim();
      if (!name) return;
      newParticipantName = "";
      try {
          await activeKimpay.addParticipant(name);
          toasts.success($t('members.added', { name }));
      } catch (e) {
          console.error(e);
          if (!newParticipantName) newParticipantName = name;
          toasts.error(getErrorMessage(e, $t));
      }
  }

  function handleDeleteParticipant(participant: Participant) {
      modals.confirm({
          title: $t('modal.delete_participant.title'),
          description: $t('modal.delete_participant.confirm'),
          confirmText: $t('common.delete'),
          variant: 'destructive',
          onConfirm: async () => {
              await activeKimpay.deleteParticipant(participant.id);
              toasts.success($t('members.removed', { name: participant.name }));
          }
      });
  }
</script>

<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-4">
    <h1 class="sr-only">{$t('nav.members')}</h1>

    <Button size="lg" class="w-full animate-pop-in" onclick={() => isInviteOpen = true}>
        <UserPlus class="size-5!" />
        {$t('members.invite')}
    </Button>

    <section class="space-y-2 animate-slide-up">
        <SectionLabel title={$t('members.count', { count: String(participants.length) })} />
        {#if isLoading && participants.length === 0}
            <ListSkeleton count={2} />
        {:else}
            <ListGroup>
                {#each participants as p (p.id)}
                    {@const isMe = currentParticipantId === p.id}
                    <!-- People only: the balances are in the Balance tab. -->
                    <button
                        type="button"
                        onclick={() => openedId = p.id}
                        class="flex w-full min-h-14 items-center gap-3 px-4 py-2 text-left transition-colors duration-150 first:rounded-t-[inherit] hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-hidden"
                        data-participant-id={p.id}
                        data-is-me={isMe}
                    >
                        <Avatar name={p.name} record={p} class="h-9 w-9 shrink-0 text-xs" />
                        <span class="flex min-w-0 flex-1 items-center gap-2">
                            <span class="truncate text-base font-medium">{p.name}</span>
                            {#if isMe}
                                <Badge>{$t('common.you')}</Badge>
                            {/if}
                        </span>
                        <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                {/each}

                {#if !offlineStore.isOffline}
                    <div class="flex items-center gap-2 px-4 py-3">
                        <Input
                            placeholder={$t('settings.participants.placeholder')}
                            aria-label={$t('settings.participants.placeholder')}
                            maxlength={NAME_MAX_LENGTH}
                            bind:value={newParticipantName}
                            onkeydown={(e) => e.key === 'Enter' && handleAddParticipant()}
                        />
                        <Button size="icon" class="shrink-0" onclick={handleAddParticipant} disabled={!newParticipantName.trim()} aria-label={$t('settings.participants.add')}>
                            <UserPlus />
                        </Button>
                    </div>
                {/if}
            </ListGroup>
        {/if}
    </section>
</div>

{#if activeKimpay}
    <MemberSheet
        participant={opened}
        {activeKimpay}
        used={!!opened && usedIds.has(opened.id)}
        onClose={() => openedId = null}
        onDelete={handleDeleteParticipant}
        onOpenProfile={() => profileMenu.open()}
    />
{/if}

<InviteSheet isOpen={isInviteOpen} onClose={() => isInviteOpen = false} link={inviteLink} groupName={kimpay?.name ?? 'Kimpay'} />
