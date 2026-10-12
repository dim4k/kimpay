<script lang="ts">

  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import { goto } from '$app/navigation';
  import { Copy, FileText, Link, LogOut, Pencil, Share2, Table, Trash2 } from "@lucide/svelte";
  import { modals } from '#lib/stores/modals.svelte.js';
  import { t, locale } from '#lib/i18n.js';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { storageService } from '#lib/services/storage.js';
  import { kimpayService } from '#lib/services/kimpay.js';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { generateUUID } from '#lib/utils/id.js';
  import { haptic } from '#lib/utils/haptic.js';
  import { toCsv, toMarkdown, exportFilename, downloadFile, type ExportFormat } from '#lib/utils/export.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';

  import { DEFAULT_KIMPAY_EMOJI } from '#lib/constants.js';
  import EmojiInput from '#lib/components/ui/EmojiInput.svelte';
  import IconTile from '#lib/components/ui/IconTile.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListRow from '#lib/components/ui/ListRow.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import Modal from '#lib/components/ui/modals/Modal.svelte';
  import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';
  import ModalActions from '#lib/components/ui/modals/ModalActions.svelte';

  // Get ActiveKimpay from context
  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpayId = $derived(activeKimpay?.id ?? '');

  let kimpay = $derived(activeKimpay?.kimpay);
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

  async function handleSave() {
      if (!editName.trim()) return;
      isSavingGroup = true;
      try {
          await activeKimpay.updateKimpay(editName.trim(), editIcon);
          isEditOpen = false;
          toasts.success($t('common.saved'));
      } catch (e) {
          console.error("Error updating", e);
          toasts.error(getErrorMessage(e, $t));
      } finally {
          isSavingGroup = false;
      }
  }

  // Read-only summary link
  let readonlyLink = $derived(kimpay?.readonly_token ? `${window.location.origin}/r/${kimpay.readonly_token}` : "");
  let isUpdatingLink = $state(false);

  async function setReadonlyLink(enabled: boolean) {
      isUpdatingLink = true;
      try {
          await activeKimpay.setReadonlyToken(enabled ? generateUUID() : "");
      } catch (e) {
          console.error("Failed to update the read-only link", e);
          toasts.error(getErrorMessage(e, $t));
      } finally {
          isUpdatingLink = false;
      }
  }

  function requestDisableReadonlyLink() {
      modals.confirm({
          title: $t('settings.readonly.disable_title'),
          description: $t('settings.readonly.disable_desc'),
          confirmText: $t('settings.readonly.disable'),
          variant: 'destructive',
          onConfirm: () => setReadonlyLink(false)
      });
  }

  async function copyReadonlyLink() {
      try {
          await navigator.clipboard.writeText(readonlyLink);
          haptic('light');
          toasts.success($t('share.copy_success'));
      } catch (err) {
          console.error('Failed to copy', err);
          toasts.error($t('share.copy_error'));
      }
  }

  async function shareReadonlyLink() {
      if (!navigator.share) return copyReadonlyLink();
      try {
          await navigator.share({ title: kimpay?.name ?? 'Kimpay', url: readonlyLink });
      } catch {
          // Share sheet dismissed.
      }
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
                     toasts.error($t('error.generic'));
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
          toasts.error(getErrorMessage(e, $t));
      }
  }

</script>

<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-4">
    <h1 class="sr-only">{$t('nav.group')}</h1>

    <!-- The group -->
    <section class="flex items-center gap-3 rounded-card border bg-card p-4 animate-pop-in">
        <IconTile size="lg" class="text-foreground">{kimpay?.icon || DEFAULT_KIMPAY_EMOJI}</IconTile>
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
        <section class="space-y-2 animate-slide-up">
            <SectionLabel title={$t('settings.readonly.title')} />
            <div class="space-y-3 rounded-card border bg-card p-4">
                <p class="text-sm text-muted-foreground">{$t('settings.readonly.desc')}</p>
                {#if readonlyLink}
                    <div class="flex items-center gap-2 rounded-control bg-muted px-3 py-2.5">
                        <Link class="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span class="min-w-0 flex-1 truncate font-mono text-sm text-muted-foreground">{readonlyLink}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <Button variant="outline" onclick={copyReadonlyLink}>
                            <Copy />
                            {$t('share.copy_button')}
                        </Button>
                        <Button variant="outline" onclick={shareReadonlyLink}>
                            <Share2 />
                            {$t('nav.share')}
                        </Button>
                    </div>
                    <Button variant="ghost-destructive" class="w-full" onclick={requestDisableReadonlyLink} disabled={isUpdatingLink}>
                        <Trash2 />
                        {$t('settings.readonly.disable')}
                    </Button>
                {:else}
                    <Button variant="outline" class="w-full" onclick={() => setReadonlyLink(true)} loading={isUpdatingLink}>
                        {#if !isUpdatingLink}<Link />{/if}
                        {$t('settings.readonly.create')}
                    </Button>
                {/if}
            </div>
        </section>
    {/if}

    <section class="space-y-2">
        <SectionLabel title={$t('settings.section.data')} />
        <ListGroup>
            <ListRow icon={Table} title={$t('settings.export.as', { format: $t('settings.export.csv') })} onclick={() => handleExport('csv')} />
            <ListRow icon={FileText} title={$t('settings.export.as', { format: $t('settings.export.md') })} onclick={() => handleExport('md')} />
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
</div>

<Modal isOpen={isEditOpen} onClose={() => isEditOpen = false} variant="sheet" label={$t('settings.edit_group')} class="overflow-visible">
    <ModalHeader title={$t('settings.edit_group')} align="start" />
    <div class="space-y-2">
        <Label for="group-name">{$t('home.create.name_label')}</Label>
        <div class="flex gap-2">
            <EmojiInput variant="kimpay" bind:value={editIcon} />
            <Input id="group-name" bind:value={editName} onkeydown={(e) => e.key === 'Enter' && handleSave()} />
        </div>
    </div>
    <ModalActions>
        <Button variant="secondary" onclick={() => isEditOpen = false}>{$t('common.cancel')}</Button>
        <Button onclick={handleSave} loading={isSavingGroup} disabled={!editName.trim()}>
            {$t('common.save')}
        </Button>
    </ModalActions>
</Modal>
