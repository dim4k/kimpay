<script lang="ts">
  import { ChevronRight, Link, UserPlus } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { profileMenu } from '#lib/stores/profileMenu.svelte.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { defaultSharesOf, hasJoined, personalInviteLink } from '#lib/utils/members.js';
  import { NAME_MAX_LENGTH } from '#lib/constants.js';
  import { DEFAULT_CURRENCY } from '#lib/services/currency.js';
  import type { Transaction } from '#lib/balance.js';
  import type { Participant } from '#lib/types.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import Badge from '#lib/components/ui/Badge.svelte';
  import IconTile from '#lib/components/ui/IconTile.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import InviteSheet from '#lib/components/members/InviteSheet.svelte';
  import MemberSheet from '#lib/components/members/MemberSheet.svelte';
  import SettleSheet from '#lib/components/balance/SettleSheet.svelte';

  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpay = $derived(activeKimpay?.kimpay);
  let participants = $derived(activeKimpay?.participants || []);
  let currentParticipantId = $derived(activeKimpay?.myParticipantId ?? null);
  let isLoading = $derived(activeKimpay?.loading ?? true);

  // The link opening the group (this page's URL, without the tab).
  let inviteLink = $derived(activeKimpay?.id ? `${window.location.origin}/k/${activeKimpay.id}` : '');
  // The group's link, or a member's own (their name suggested on arrival).
  // Kept while the sheet closes.
  let isInviteOpen = $state(false);
  let invitee = $state<Participant | null>(null);
  let invitedLink = $derived(invitee ? personalInviteLink(inviteLink, invitee.id) : inviteLink);

  function invite(participant: Participant | null) {
      invitee = participant;
      isInviteOpen = true;
  }

  // Alone in the group: inviting is the next step, at the top. Then it is a
  // row of the list.
  let isAlone = $derived(participants.length <= 1);

  // Who takes part first, then the names not here yet, then those who left
  // (in the order they were added).
  let rows = $derived(
      participants
          .map((p) => ({ p, joined: hasJoined(p, currentParticipantId) }))
          .sort((a, b) => rank(a) - rank(b))
  );
  function rank(row: { p: Participant; joined: boolean }): number {
      if (row.p.inactive) return 2;
      return row.joined ? 0 : 1;
  }
  let joinedCount = $derived(rows.filter((r) => r.joined).length);

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
  // The member whose sheet is open.
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

  // A payment between me and a member, recorded from their sheet.
  let settling = $state<Transaction | null>(null);
  let kimpayCurrency = $derived(kimpay?.currency || DEFAULT_CURRENCY);

  function label(id: string): string {
      return id === currentParticipantId ? $t('common.you') : activeKimpay?.participantsById.get(id)?.name || $t('common.unknown');
  }

  function openSettle(tx: Transaction) {
      if (offlineStore.isOffline) {
          toasts.warning($t('balance.reimbursement.offline_unavailable'));
          return;
      }
      openedId = null;
      settling = tx;
  }
</script>

<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-4">
    <h1 class="sr-only">{$t('nav.members')}</h1>

    {#if isAlone}
        <Button size="lg" class="w-full animate-pop-in" onclick={() => invite(null)}>
            <UserPlus class="size-5!" />
            {$t('members.invite')}
        </Button>
    {/if}

    <section class="space-y-2 animate-slide-up">
        <SectionLabel
            title={joinedCount < participants.length
                ? $t('members.count_joined', { count: String(participants.length), joined: String(joinedCount) })
                : $t('members.count', { count: String(participants.length) })}
        />
        {#if isLoading && participants.length === 0}
            <ListSkeleton count={2} />
        {:else}
            <ListGroup>
                {#each rows as { p, joined } (p.id)}
                    {@const isMe = currentParticipantId === p.id}
                    {@const shares = defaultSharesOf(p)}
                    {@const canInvite = !joined && !p.inactive}
                    <!-- People only: the balances are in the Balance tab. -->
                    <div
                        class="flex min-h-14 items-center first:rounded-t-[inherit] {canInvite ? 'pr-4' : ''}"
                        data-participant-id={p.id}
                        data-is-me={isMe}
                        data-joined={joined}
                    >
                        <button
                            type="button"
                            onclick={() => openedId = p.id}
                            class="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2 pl-4 text-left transition-colors duration-150 hover:bg-muted/60 focus-ring-inset {canInvite ? 'rounded-r-control pr-2' : 'pr-4'}"
                        >
                            <Avatar name={p.name} record={p} class="h-9 w-9 shrink-0 text-xs {p.inactive ? 'opacity-50' : ''}" />
                            <span class="min-w-0 flex-1">
                                <span class="flex items-center gap-2">
                                    <span class="truncate text-base font-medium {p.inactive ? 'text-muted-foreground' : ''}">{p.name}</span>
                                    {#if isMe}
                                        <Badge>{$t('common.you')}</Badge>
                                    {/if}
                                </span>
                                {#if p.inactive || !isMe || shares > 1}
                                    <span class="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                                        {#if p.inactive}
                                            <span>{$t('members.inactive')}</span>
                                        {:else if !isMe}
                                            <span class={joined ? 'text-success' : ''}>{joined ? $t('members.joined') : $t('members.not_joined')}</span>
                                        {/if}
                                        {#if shares > 1}
                                            {#if p.inactive || !isMe}<span aria-hidden="true">·</span>{/if}
                                            <span class="font-medium text-primary">{$t('members.shares', { count: String(shares) })}</span>
                                        {/if}
                                    </span>
                                {/if}
                            </span>
                            {#if !canInvite}
                                <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
                            {/if}
                        </button>
                        {#if canInvite}
                            <Button size="sm" variant="soft" class="shrink-0" onclick={() => invite(p)} aria-label={$t('members.invite_named', { name: p.name })}>
                                {$t('members.invite_short')}
                            </Button>
                        {/if}
                    </div>
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

                {#if !isAlone}
                    <button
                        type="button"
                        onclick={() => invite(null)}
                        class="flex w-full min-h-14 items-center gap-3 px-4 py-2 text-left text-base font-semibold text-primary transition-colors duration-150 last:rounded-b-[inherit] hover:bg-muted/60 focus-ring-inset"
                    >
                        <IconTile size="sm" tone="primary"><Link /></IconTile>
                        {$t('members.share_link')}
                    </button>
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
        onInvite={(p) => { openedId = null; invite(p); }}
        onSettle={openSettle}
    />
{/if}

<InviteSheet
    isOpen={isInviteOpen}
    onClose={() => isInviteOpen = false}
    link={invitedLink}
    groupName={kimpay?.name ?? 'Kimpay'}
    name={invitee?.name}
/>

<SettleSheet
    tx={settling}
    from={settling ? label(settling.from) : ''}
    to={settling ? label(settling.to) : ''}
    displayCurrency={kimpayCurrency}
    exchangeRates={activeKimpay?.exchangeRates ?? {}}
    onClose={() => settling = null}
    onConfirm={async (amount, date) => {
        try {
            await activeKimpay.recordReimbursement(settling!, $t('balance.reimbursement'), amount, date);
        } catch (e) {
            console.error("Failed to record the reimbursement", e);
            toasts.error(getErrorMessage(e, $t));
            throw e;
        }
    }}
/>
