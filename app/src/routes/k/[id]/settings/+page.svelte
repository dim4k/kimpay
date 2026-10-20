<script lang="ts">

  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import { goto } from '$app/navigation';
  import { Archive, ArchiveRestore, Eye, FileText, History, Link, LogOut, Pencil, Table, Trash2 } from "@lucide/svelte";
  import { modals } from '#lib/stores/modals.svelte.js';
  import { t, locale } from '#lib/i18n.js';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { storageService } from '#lib/services/storage.js';
  import { kimpayService } from '#lib/services/kimpay.js';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import { archiveStore } from '#lib/stores/archive.svelte.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { generateUUID } from '#lib/utils/id.js';
  import { toCsv, toMarkdown, exportFilename, downloadFile, type ExportFormat } from '#lib/utils/export.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';

  import { DEFAULT_KIMPAY_EMOJI, GROUP_NAME_MAX_LENGTH } from '#lib/constants.js';
  import EmojiInput from '#lib/components/ui/EmojiInput.svelte';
  import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
  import { DEFAULT_CURRENCY } from '#lib/services/currency.js';
  import IconTile from '#lib/components/ui/IconTile.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListRow from '#lib/components/ui/ListRow.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import Modal from '#lib/components/ui/modals/Modal.svelte';
  import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';
  import LinkShare from '#lib/components/LinkShare.svelte';

  // Get ActiveKimpay from context
  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpayId = $derived(activeKimpay?.id ?? '');

  let kimpay = $derived(activeKimpay?.kimpay);
  let currentParticipantId = $derived(activeKimpay?.myParticipantId ?? null);
  // Deleting needs the group's owner account (set at creation, or claimed
  // with the creator key of this device), not only the creator's participant.
  let isCreator = $derived(kimpay?.created_by === currentParticipantId && !!auth.user && kimpay?.owner === auth.user.id);
  // Created from this device without an account: deleting needs one (the
  // server checks the creator's account).
  let isGuestCreator = $derived(!!currentParticipantId && kimpay?.created_by === currentParticipantId && !auth.user);
  let creatorName = $derived(
      kimpay?.created_by === currentParticipantId
          ? $t('common.you_in_sentence')
          : activeKimpay?.participantsById.get(kimpay?.created_by ?? '')?.name
  );

  // Group name, icon and currency, edited in a sheet
  let isEditOpen = $state(false);
  let editName = $state("");
  let editIcon = $state("");
  let editCurrency = $state("");
  let isSavingGroup = $state(false);
  let groupCurrency = $derived(kimpay?.currency || DEFAULT_CURRENCY);

  function openEdit() {
      editName = kimpay?.name ?? "";
      editIcon = kimpay?.icon || DEFAULT_KIMPAY_EMOJI;
      editCurrency = groupCurrency;
      isEditOpen = true;
  }

  // Another currency: online only. Expenses in other currencies are
  // converted at today's rate, after a confirmation saying so.
  function handleSave() {
      if (!editName.trim() || !activeKimpay) return;
      const to = editCurrency;
      if (to === groupCurrency) return save(false);
      if (offlineStore.isOffline) {
          toasts.warning($t('settings.currency.offline'));
          return;
      }
      const converts = activeKimpay.expenses.some((e) => (e.currency || DEFAULT_CURRENCY) !== to);
      if (!converts) return save(true);
      const rate = activeKimpay.currencyRate(to);
      if (rate === null) {
          toasts.error($t('settings.currency.no_rate'));
          return;
      }
      isEditOpen = false;
      modals.confirm({
          title: $t('settings.currency.confirm_title', { to }),
          description: $t('settings.currency.confirm_desc', {
              from: groupCurrency,
              to,
              rate: rate.toLocaleString($locale, { maximumSignificantDigits: 4 }),
          }),
          confirmText: $t('settings.currency.confirm', { to }),
          onConfirm: () => save(true),
      });
  }

  async function save(currencyChanged: boolean) {
      isSavingGroup = true;
      try {
          if (currencyChanged) await activeKimpay.changeCurrency(editCurrency);
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
      isReadonlyOpen = false;
      modals.confirm({
          title: $t('settings.readonly.disable_title'),
          description: $t('settings.readonly.disable_desc'),
          confirmText: $t('settings.readonly.disable'),
          variant: 'destructive',
          onConfirm: () => setReadonlyLink(false)
      });
  }

  // The read-only link: one line here, its sheet to give it or turn it off.
  let isReadonlyOpen = $state(false);

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
                     // A lost connection is said as such.
                     toasts.error(getErrorMessage(result.error, $t));
                     return;
                 }
             }
             await leaveKimpayPage();
          }
      });
  }

  // Archiving is personal (see archiveStore): done with this Kimpay, it is
  // folded on the home page, where we go back to.
  let isArchived = $derived(archiveStore.has(kimpayId));

  async function toggleArchived() {
      const archived = !isArchived;
      try {
          await archiveStore.set(kimpayId, archived);
          toasts.success($t(archived ? 'home.archive.done' : 'home.archive.restored', { name: kimpay?.name ?? '' }));
          if (archived) await goto('/');
      } catch (e) {
          console.error("Failed to archive", e);
          toasts.error(getErrorMessage(e, $t));
      }
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
    <h1 class="sr-only">{$t('nav.settings')}</h1>

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

    <section class="space-y-2">
        <SectionLabel title={$t('settings.section.data')} />
        <ListGroup>
            <ListRow icon={History} title={$t('activity.title')} subtitle={$t('activity.desc')} href="/k/{kimpayId}/settings/activity" />
            {#if !offlineStore.isOffline}
                <ListRow
                    icon={Eye}
                    title={$t('settings.readonly.title')}
                    value={readonlyLink ? $t('settings.readonly.on') : $t('settings.readonly.off')}
                    onclick={() => isReadonlyOpen = true}
                />
            {/if}
            <ListRow icon={Table} title={$t('settings.export.as', { format: $t('settings.export.csv') })} onclick={() => handleExport('csv')} />
            <ListRow icon={FileText} title={$t('settings.export.as', { format: $t('settings.export.md') })} onclick={() => handleExport('md')} />
        </ListGroup>
    </section>

    <section class="space-y-2">
        <ListGroup>
            <!-- Saved on the account when logged in: online only then -->
            <ListRow
                icon={isArchived ? ArchiveRestore : Archive}
                title={$t(isArchived ? 'settings.unarchive' : 'settings.archive')}
                subtitle={$t(isArchived ? 'settings.unarchive_desc' : 'settings.archive_desc')}
                onclick={toggleArchived}
                disabled={offlineStore.isOffline && !!auth.user}
            />
            <ListRow icon={LogOut} tone="danger" title={$t('settings.leave_group')} subtitle={$t('settings.actions.remove_desc')} onclick={requestLeave} disabled={offlineStore.isOffline} />
            {#if isCreator}
                <ListRow icon={Trash2} tone="danger" title={$t('settings.delete_group')} subtitle={$t('settings.actions.delete_desc')} onclick={requestDelete} disabled={offlineStore.isOffline} />
            {:else if isGuestCreator}
                <ListRow
                    icon={Trash2}
                    title={$t('settings.delete_group')}
                    subtitle={$t('settings.delete_needs_account')}
                    onclick={() => modals.register({ description: $t('settings.delete_needs_account') })}
                    disabled={offlineStore.isOffline}
                />
            {/if}
        </ListGroup>
    </section>
</div>

{#snippet editFooter()}
    <Button size="lg" class="w-full" onclick={handleSave} loading={isSavingGroup} disabled={!editName.trim()}>
        {$t('common.save')}
    </Button>
{/snippet}

<Modal isOpen={isEditOpen} onClose={() => isEditOpen = false} variant="sheet" label={$t('settings.edit_group')} footer={editFooter}>
    {#snippet header()}
        <ModalHeader title={$t('settings.edit_group')} align="start" onClose={() => isEditOpen = false} />
    {/snippet}
    <div class="space-y-2">
        <Label for="group-name">{$t('home.create.name_label')}</Label>
        <div class="flex gap-2">
            <EmojiInput variant="kimpay" bind:value={editIcon} />
            <Input id="group-name" bind:value={editName} maxlength={GROUP_NAME_MAX_LENGTH} onkeydown={(e) => e.key === 'Enter' && handleSave()} />
            <CurrencySelect bind:value={editCurrency} triggerClass="h-11 shrink-0 gap-1 px-3" />
        </div>
        {#if editCurrency !== groupCurrency && (activeKimpay?.expenses.length ?? 0) > 0}
            <p class="text-sm text-muted-foreground">{$t('settings.currency.hint', { to: editCurrency })}</p>
        {/if}
    </div>
</Modal>

<Modal isOpen={isReadonlyOpen} onClose={() => isReadonlyOpen = false} variant="sheet" label={$t('settings.readonly.title')}>
    <ModalHeader title={$t('settings.readonly.title')} description={$t('settings.readonly.desc')} icon={Eye} align="start" onClose={() => isReadonlyOpen = false} />
    {#if readonlyLink}
        <LinkShare link={readonlyLink} shareTitle={kimpay?.name ?? 'Kimpay'} qrAlt={$t('settings.readonly.qr_alt')} />
        <Button variant="ghost-destructive" class="w-full" onclick={requestDisableReadonlyLink} disabled={isUpdatingLink}>
            <Trash2 />
            {$t('settings.readonly.disable')}
        </Button>
    {:else}
        <Button size="lg" class="w-full" onclick={() => setReadonlyLink(true)} loading={isUpdatingLink}>
            {#if !isUpdatingLink}<Link />{/if}
            {$t('settings.readonly.create')}
        </Button>
    {/if}
</Modal>
