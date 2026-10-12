<script lang="ts">

  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import { goto } from '$app/navigation';
  import { LogOut, Trash2, UserPlus, UserRoundCheck, Bug, Download, FileText, Table, LoaderCircle, Wallet, Pencil } from "@lucide/svelte";
  import { modals } from '#lib/stores/modals.svelte.js';
  import { t } from '#lib/i18n.js';
  import { installStore } from '#lib/stores/install.svelte.js';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { storageService } from '#lib/services/storage.js';
  import { kimpayService } from '#lib/services/kimpay.js';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { toCsv, toMarkdown, exportFilename, downloadFile, type ExportFormat } from '#lib/utils/export.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';

  import { DEFAULT_KIMPAY_EMOJI } from '#lib/constants.js';
  import EmojiInput from '#lib/components/ui/EmojiInput.svelte';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import Badge from '#lib/components/ui/Badge.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListRow from '#lib/components/ui/ListRow.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import Modal from '#lib/components/ui/modals/Modal.svelte';
  import { locale } from '#lib/i18n.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { normalizeHandle } from '#lib/utils/payment.js';

  // Get ActiveKimpay from context
  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpayId = $derived(activeKimpay?.id ?? '');

  // Use stores
  let kimpay = $derived(activeKimpay?.kimpay);
  let participants = $derived(activeKimpay?.participants || []);
  let currentParticipantId = $derived(activeKimpay?.myParticipantId ?? null);
  let isCreator = $derived(kimpay?.created_by === currentParticipantId && !!auth.user);
  let creatorName = $derived(
      kimpay?.created_by === currentParticipantId
          ? $t('common.you_in_sentence')
          : activeKimpay?.participantsById.get(kimpay?.created_by ?? '')?.name
  );

  // Group name and icon, edited in a sheet
  let isEditOpen = $state(false);
  let editName = $state("");
  let editIcon = $state("");
  let isSavingGroup = $state(false);

  function openEdit() {
      editName = kimpay?.name ?? "";
      editIcon = kimpay?.icon || DEFAULT_KIMPAY_EMOJI;
      isEditOpen = true;
  }

  function checkUsage(pId: string): boolean {
      const allExpenses = activeKimpay?.expenses || [];
      return allExpenses.some((e) => e.payer === pId || (e.involved && e.involved.includes(pId)));
  }

  async function handleSave() {
      if (!editName.trim()) return;
      isSavingGroup = true;
      try {
          await activeKimpay.updateKimpay(editName.trim(), editIcon);
          isEditOpen = false;
          toasts.success($t('common.saved'));
      } catch (e) {
          console.error("Error updating", e);
          modals.alert({ message: getErrorMessage(e, $t) });
      } finally {
          isSavingGroup = false;
      }
  }

  // Participants State
  let newParticipantName = $state("");
  let isAddingParticipant = $state(false);
  let addFeedback = $state("");
  let isDeletingParticipant = $state<string | null>(null);

  async function handleAddParticipant() {
      if(!newParticipantName.trim()) return;
      isAddingParticipant = true;
      addFeedback = "";
      try {
          await activeKimpay.addParticipant(newParticipantName);
          newParticipantName = "";
          addFeedback = "added";
          setTimeout(() => addFeedback = "", 2000);
      } catch(e) {
          console.error(e);
          modals.alert({ message: getErrorMessage(e, $t) });
      } finally {
          isAddingParticipant = false;
      }
  }

  function handleDeleteParticipant(pId: string) {
      // Participants involved in an expense cannot be deleted.
      if (checkUsage(pId)) {
          modals.alert({ message: $t('error.participant.used') });
          return;
      }

      modals.confirm({
          title: $t('modal.delete_participant.title'),
          description: $t('modal.delete_participant.confirm'),
          confirmText: $t('common.delete'),
          variant: 'destructive',
          onConfirm: async () => {
              isDeletingParticipant = pId;
              try {
                  await activeKimpay.deleteParticipant(pId);
              } finally {
                  isDeletingParticipant = null;
              }
          }
      });
  }

  function requestLeave() {
      if (offlineStore.isOffline) return;
      modals.confirm({
          title: $t('modal.leave.title'),
          description: $t('modal.leave.desc'),
          confirmText: $t('modal.leave.confirm'),
          cancelText: $t('common.cancel'),
          variant: 'destructive',
          onConfirm: async () => {
             // Deletes our participant when possible, otherwise unclaims it.
             if (currentParticipantId) {
                 const result = await kimpayService.leave(kimpayId, currentParticipantId);
                 if (!result.success) {
                     modals.alert({ message: $t('error.generic'), variant: 'error' });
                     return;
                 }
             }
             await leaveKimpayPage();
          }
      });
  }

  function requestDelete() {
      if (offlineStore.isOffline) return;
      modals.confirm({
          title: $t('settings.delete_group'),
          description: $t('settings.actions.delete_warning'),
          confirmText: $t('common.delete'),
          variant: 'destructive',
          onConfirm: async () => {
            await activeKimpay.deleteKimpay();
            await leaveKimpayPage();
          }
      });
  }

  /** Forget this Kimpay locally and go home. */
  async function leaveKimpayPage() {
      const id = kimpayId;
      recentsStore.removeRecentKimpay(id);
      // Navigate first: the active Kimpay is destroyed on unmount, so it can
      // no longer re-cache the group after it is removed from storage.
      await goto('/');
      await storageService.removeRecentKimpay(id);
  }

  function handleSwitchIdentity(pId: string) {
      modals.confirm({
          title: $t('settings.switch_identity'),
          description: $t('settings.switch_modal.desc'),
          confirmText: $t('common.save'),
          onConfirm: async () => {
              await activeKimpay.setMyParticipant(pId);
          }
      });
  }

  function handleExport(format: ExportFormat) {
      if (!kimpay || !activeKimpay) return;
      try {
          const input = {
              kimpay,
              expenses: activeKimpay.expenses,
              participants: activeKimpay.participants,
              rates: activeKimpay.exchangeRates,
              t: $t,
              locale: $locale,
          };
          const content = format === 'csv' ? toCsv(input) : toMarkdown(input);
          downloadFile(content, exportFilename(kimpay, format), format === 'csv' ? 'text/csv' : 'text/markdown');
      } catch (e) {
          console.error("Export failed", e);
          modals.alert({ message: getErrorMessage(e, $t), variant: 'error' });
      }
  }

  // Payment handles of the current identity, edited in a sheet
  let me = $derived(currentParticipantId ? activeKimpay?.participantsById.get(currentParticipantId) : undefined);
  let isPaymentOpen = $state(false);
  let paypalInput = $state("");
  let revolutInput = $state("");
  let isSavingHandles = $state(false);
  let handlesSummary = $derived([me?.paypal && 'PayPal', me?.revolut && 'Revolut'].filter(Boolean).join(', '));

  function openPayment() {
      paypalInput = me?.paypal ?? "";
      revolutInput = me?.revolut ?? "";
      isPaymentOpen = true;
  }

  async function savePaymentHandles() {
      const paypal = normalizeHandle(paypalInput);
      const revolut = normalizeHandle(revolutInput);
      if (paypal === null || revolut === null) {
          modals.alert({ message: $t('payment.invalid_handle') });
          return;
      }
      isSavingHandles = true;
      try {
          await activeKimpay.updateMyPaymentHandles({ paypal, revolut });
          isPaymentOpen = false;
          toasts.success($t('common.saved'));
      } catch (e) {
          console.error("Failed to save payment handles", e);
          modals.alert({ message: getErrorMessage(e, $t) });
      } finally {
          isSavingHandles = false;
      }
  }
</script>

{#snippet handleInput(id: 'paypal' | 'revolut', label: string, prefix: string)}
    <div class="space-y-2">
        <Label for={id}>{label}</Label>
        <div class="flex h-11 items-center rounded-control border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
            <span class="select-none pl-3 text-base text-muted-foreground">{prefix}</span>
            {#if id === 'paypal'}
                <input {id} bind:value={paypalInput} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder={$t('settings.payment.handle_placeholder')} class="h-full min-w-0 flex-1 bg-transparent pr-3 text-base outline-hidden" />
            {:else}
                <input {id} bind:value={revolutInput} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder={$t('settings.payment.handle_placeholder')} class="h-full min-w-0 flex-1 bg-transparent pr-3 text-base outline-hidden" />
            {/if}
        </div>
    </div>
{/snippet}

<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-4">
    <h1 class="sr-only">{$t('settings.title')}</h1>

    <!-- The group -->
    <section class="flex items-center gap-3 rounded-card border bg-card p-4 animate-pop-in">
        <span class="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-muted text-3xl" aria-hidden="true">
            {kimpay?.icon || DEFAULT_KIMPAY_EMOJI}
        </span>
        <div class="min-w-0 flex-1">
            <p class="truncate text-xl font-bold">{kimpay?.name ?? ''}</p>
            <p class="truncate text-sm text-muted-foreground">
                {kimpay?.currency}{creatorName ? ` · ${$t('settings.created_by', { name: creatorName })}` : ''}
            </p>
        </div>
        {#if !offlineStore.isOffline}
            <Button variant="outline" size="sm" onclick={openEdit}>
                <Pencil />
                {$t('common.edit')}
            </Button>
        {/if}
    </section>

    {#if !offlineStore.isOffline}
        <section class="space-y-2">
            <SectionLabel title="{$t('settings.participants')} ({participants.length})" />
            <ListGroup>
                {#each participants as p (p.id)}
                    {@const isMe = currentParticipantId === p.id}
                    <div
                        class="group flex min-h-14 items-center gap-3 py-2 pl-4 pr-2 first:rounded-t-[inherit]"
                        data-participant-id={p.id}
                        data-is-me={isMe}
                        data-current-participant={currentParticipantId}
                    >
                        <Avatar name={p.name} record={p} class="h-9 w-9 shrink-0 text-xs" />
                        <span class="flex min-w-0 flex-1 items-center gap-2">
                            <span class="truncate text-base font-medium">{p.name}</span>
                            {#if isMe}
                                <Badge>{$t('common.you')}</Badge>
                            {/if}
                        </span>
                        {#if !isMe}
                            <Button
                                variant="ghost"
                                size="icon"
                                class="text-muted-foreground hover:text-primary"
                                onclick={() => handleSwitchIdentity(p.id)}
                                title={$t('settings.switch_identity')}
                                aria-label={$t('settings.switch_identity')}
                            >
                                <UserRoundCheck />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="text-muted-foreground hover:text-destructive"
                                onclick={() => handleDeleteParticipant(p.id)}
                                disabled={isDeletingParticipant === p.id}
                                title={$t('modal.delete_participant.title')}
                                aria-label={$t('modal.delete_participant.title')}
                            >
                                {#if isDeletingParticipant === p.id}
                                    <LoaderCircle class="animate-spin" />
                                {:else}
                                    <Trash2 />
                                {/if}
                            </Button>
                        {/if}
                    </div>
                {/each}

                <div class="flex items-center gap-2 px-4 py-3">
                    <div class="relative flex-1">
                        <Input
                            placeholder={$t('settings.participants.placeholder')}
                            aria-label={$t('settings.participants.placeholder')}
                            bind:value={newParticipantName}
                            onkeydown={(e) => e.key === 'Enter' && handleAddParticipant()}
                        />
                        {#if addFeedback === 'added'}
                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-success">{$t('settings.participants.added')}</span>
                        {/if}
                    </div>
                    <Button size="icon" onclick={handleAddParticipant} disabled={isAddingParticipant || !newParticipantName.trim()} aria-label={$t('settings.participants.add')}>
                        {#if isAddingParticipant}
                            <LoaderCircle class="animate-spin" />
                        {:else}
                            <UserPlus />
                        {/if}
                    </Button>
                </div>
            </ListGroup>
        </section>
    {/if}

    <section class="space-y-2">
        <SectionLabel title={$t('settings.section.more')} />
        <ListGroup>
            {#if !offlineStore.isOffline && me}
                <ListRow icon={Wallet} title={$t('settings.payment.title')} value={handlesSummary || $t('settings.payment.none')} onclick={openPayment} />
            {/if}
            {#if !installStore.isStandalone && (installStore.canInstall || installStore.isIOS)}
                <ListRow icon={Download} title={$t('settings.install.button')} onclick={() => installStore.install()} />
            {/if}
            <ListRow icon={Table} title={$t('settings.export.as', { format: $t('settings.export.csv') })} onclick={() => handleExport('csv')} />
            <ListRow icon={FileText} title={$t('settings.export.as', { format: $t('settings.export.md') })} onclick={() => handleExport('md')} />
            {#if !offlineStore.isOffline}
                <ListRow icon={Bug} title={$t('settings.bug_report.title')} href="https://github.com/dim4k/kimpay/issues" external />
            {/if}
        </ListGroup>
    </section>

    <section class="space-y-2">
        <ListGroup>
            <ListRow icon={LogOut} tone="danger" title={$t('settings.leave_group')} subtitle={$t('settings.actions.remove_desc')} onclick={requestLeave} disabled={offlineStore.isOffline} />
            {#if isCreator}
                <ListRow icon={Trash2} tone="danger" title={$t('settings.delete_group')} subtitle={$t('settings.actions.delete_desc')} onclick={requestDelete} disabled={offlineStore.isOffline} />
            {/if}
        </ListGroup>
    </section>

    <p class="pt-2 text-center text-xs text-muted-foreground">Kimpay v{__APP_VERSION__}</p>
</div>

<Modal isOpen={isEditOpen} onClose={() => isEditOpen = false} variant="sheet" label={$t('settings.edit_group')} class="overflow-visible">
    <h2 class="text-xl font-bold">{$t('settings.edit_group')}</h2>
    <div class="space-y-2">
        <Label for="group-name">{$t('home.create.name_label')}</Label>
        <div class="flex gap-2">
            <EmojiInput variant="kimpay" bind:value={editIcon} />
            <Input id="group-name" bind:value={editName} onkeydown={(e) => e.key === 'Enter' && handleSave()} />
        </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
        <Button variant="secondary" onclick={() => isEditOpen = false}>{$t('common.cancel')}</Button>
        <Button onclick={handleSave} disabled={isSavingGroup || !editName.trim()}>
            {#if isSavingGroup}<LoaderCircle class="animate-spin" />{/if}
            {$t('common.save')}
        </Button>
    </div>
</Modal>

<Modal isOpen={isPaymentOpen} onClose={() => isPaymentOpen = false} variant="sheet" label={$t('settings.payment.title')}>
    <div class="space-y-1">
        <h2 class="text-xl font-bold">{$t('settings.payment.title')}</h2>
        <p class="text-sm text-muted-foreground">{$t('settings.payment.desc')}</p>
    </div>
    <div class="space-y-4">
        {@render handleInput('paypal', 'PayPal.me', 'paypal.me/')}
        {@render handleInput('revolut', 'Revolut.me', 'revolut.me/')}
    </div>
    <div class="grid grid-cols-2 gap-3">
        <Button variant="secondary" onclick={() => isPaymentOpen = false}>{$t('common.cancel')}</Button>
        <Button onclick={savePaymentHandles} disabled={isSavingHandles}>
            {#if isSavingHandles}<LoaderCircle class="animate-spin" />{/if}
            {$t('common.save')}
        </Button>
    </div>
</Modal>
