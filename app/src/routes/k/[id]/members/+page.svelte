<script lang="ts">
  import { ChevronRight, Trash2, UserPlus } from "@lucide/svelte";
  import { t, locale } from '#lib/i18n.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { profileMenu } from '#lib/stores/profileMenu.svelte.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { DEFAULT_CURRENCY, formatAmount } from '#lib/services/currency.js';
  import { NAME_MAX_LENGTH } from '#lib/constants.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import Badge from '#lib/components/ui/Badge.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import InviteSheet from '#lib/components/members/InviteSheet.svelte';

  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpay = $derived(activeKimpay?.kimpay);
  let participants = $derived(activeKimpay?.participants || []);
  let currentParticipantId = $derived(activeKimpay?.myParticipantId ?? null);
  let currency = $derived(kimpay?.currency || DEFAULT_CURRENCY);
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
  let isAddingParticipant = $state(false);
  let isDeletingParticipant = $state<string | null>(null);

  async function handleAddParticipant() {
      const name = newParticipantName.trim();
      if (!name) return;
      isAddingParticipant = true;
      try {
          await activeKimpay.addParticipant(name);
          newParticipantName = "";
          toasts.success($t('members.added', { name }));
      } catch (e) {
          console.error(e);
          toasts.error(getErrorMessage(e, $t));
      } finally {
          isAddingParticipant = false;
      }
  }

  function handleDeleteParticipant(pId: string, name: string) {
      modals.confirm({
          title: $t('modal.delete_participant.title'),
          description: $t('modal.delete_participant.confirm'),
          confirmText: $t('common.delete'),
          variant: 'destructive',
          onConfirm: async () => {
              isDeletingParticipant = pId;
              try {
                  await activeKimpay.deleteParticipant(pId);
                  toasts.success($t('members.removed', { name }));
              } finally {
                  isDeletingParticipant = null;
              }
          }
      });
  }

  /** "+€12.00", "−€8.50", or "settled". */
  function balanceBadge(id: string): { tone: 'success' | 'warning' | 'neutral'; text: string } {
      const amount = activeKimpay?.balances[id] ?? 0;
      if (amount > 0.005) return { tone: 'success', text: `+${formatAmount(amount, currency, $locale)}` };
      if (amount < -0.005) return { tone: 'warning', text: `−${formatAmount(-amount, currency, $locale)}` };
      return { tone: 'neutral', text: $t('members.settled') };
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
                    {@const balance = balanceBadge(p.id)}
                    <div
                        class="group flex min-h-14 items-center gap-3 py-2 pl-4 pr-2 first:rounded-t-[inherit]"
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
                        <Badge tone={balance.tone}>{balance.text}</Badge>
                        {#if isMe}
                            <!-- What is mine (photo, payment links...) lives in the profile. -->
                            <Button variant="ghost" size="icon" class="text-muted-foreground" onclick={() => profileMenu.open()} aria-label={$t('settings.my_profile')} title={$t('settings.my_profile')}>
                                <ChevronRight />
                            </Button>
                        {:else if !usedIds.has(p.id) && !offlineStore.isOffline}
                            <Button
                                variant="ghost"
                                size="icon"
                                class="text-muted-foreground hover:text-destructive"
                                onclick={() => handleDeleteParticipant(p.id, p.name)}
                                loading={isDeletingParticipant === p.id}
                                title={$t('modal.delete_participant.title')}
                                aria-label={$t('modal.delete_participant.title')}
                            >
                                {#if isDeletingParticipant !== p.id}<Trash2 />{/if}
                            </Button>
                        {:else}
                            <!-- Keeps the badges aligned. -->
                            <span class="w-11 shrink-0" aria-hidden="true"></span>
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
                        <Button size="icon" class="shrink-0" onclick={handleAddParticipant} loading={isAddingParticipant} disabled={!newParticipantName.trim()} aria-label={$t('settings.participants.add')}>
                            {#if !isAddingParticipant}<UserPlus />{/if}
                        </Button>
                    </div>
                {/if}
            </ListGroup>
            <p class="px-1 text-xs text-muted-foreground">{$t('members.balance_hint')}</p>
        {/if}
    </section>
</div>

<InviteSheet isOpen={isInviteOpen} onClose={() => isInviteOpen = false} link={inviteLink} groupName={kimpay?.name ?? 'Kimpay'} />
