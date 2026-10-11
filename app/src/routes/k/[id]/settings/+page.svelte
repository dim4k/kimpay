<script lang="ts">

  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import PageHeader from '#lib/components/ui/PageHeader.svelte';
  import { goto } from '$app/navigation';
  import { LogOut, Trash2, Save, UserPlus, Users, ArrowRightLeft, Bug, Download, FileText, Table, LoaderCircle } from "@lucide/svelte";
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
  import SettingsSection from '#lib/components/ui/SettingsSection.svelte';
  import { locale } from '#lib/i18n.js';

  // Get ActiveKimpay from context
  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);
  
  let kimpayId = $derived(activeKimpay?.id ?? '');
  
  // Use stores
  let kimpay = $derived(activeKimpay?.kimpay);
  let participants = $derived(activeKimpay?.participants || []);
  let currentParticipantId = $derived(activeKimpay?.myParticipantId ?? null);
  let isCreator = $derived(kimpay?.created_by === currentParticipantId && !!auth.user);

  // Edit State
  let editName = $state("");
  let editIcon = $state("");
  
  // Feedback State
  let saveFeedback = $state("");

  // Sync local state with store when loaded
  $effect(() => {
      if (kimpay) {
          // Only set if empty to avoid overwriting user input while typing if realtime update comes in
          if (!editName) editName = kimpay.name;
          if (!editIcon) editIcon = kimpay.icon || DEFAULT_KIMPAY_EMOJI;
      }
  });

  function checkUsage(pId: string): boolean {
      const allExpenses = activeKimpay?.expenses || [];
      return allExpenses.some((e) => e.payer === pId || (e.involved && e.involved.includes(pId)));
  }

  async function handleSave() {
      saveFeedback = "";
      try {
          await activeKimpay.updateKimpay(editName, editIcon);
          
          // Recents updated inside store
          saveFeedback = "updated";
          setTimeout(() => saveFeedback = "", 2000);
      } catch (e) {
          console.error("Error updating", e);
          modals.alert({ message: getErrorMessage(e, $t) });
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
                  const isSelf = pId === currentParticipantId;
                  await activeKimpay.deleteParticipant(pId);
                  // Without an identity, the layout asks "who are you?" again.
                  if (isSelf) await activeKimpay.setMyParticipant(null);
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
          confirmText: $t('common.save'), // or 'Switch'
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
</script>

<div class="container p-4 space-y-6">
        <PageHeader title={$t('settings.title')} subtitle={$t('settings.subtitle')} />

        {#if !offlineStore.isOffline}
        <!-- Edit Section -->
        <SettingsSection title={$t('settings.edit_group')} class="relative z-20">
            <div class="space-y-4">
                <div class="space-y-2">
                    <Label for="name">{$t('home.create.name_label')}</Label>
                    <div class="flex gap-2">
                        <EmojiInput variant="kimpay" bind:value={editIcon} class="dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700" />
                        <Input id="name" bind:value={editName} class="dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700" />
                        <Button onclick={handleSave} size="icon" class="shrink-0 relative">
                            {#if saveFeedback === 'updated'}
                                <span class="absolute -top-8 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-sm">
                                    {$t('common.saved')}
                                </span>
                            {/if}
                            <Save class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </SettingsSection>
        {/if}

        {#if !offlineStore.isOffline}
        <!-- Participants Section -->
        <SettingsSection title={$t('settings.participants')} icon={Users}>
             <div class="space-y-4">
                <div class="space-y-2">
                        {#each participants as p (p.id)}
                            <div 
                                class="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700 group"
                                data-participant-id={p.id}
                                data-is-me={currentParticipantId === p.id}
                                data-current-participant={currentParticipantId}
                            >
                                <div class="flex items-center gap-3">
                                <Avatar name={p.name} record={p} class="w-8 h-8 shrink-0 text-xs" />
                                <span class="text-sm font-medium dark:text-slate-200">
                                    {p.name}
                                    {#if currentParticipantId === p.id}
                                        <span class="ml-2 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded-full">{$t('common.you')}</span>
                                    {/if}
                                </span>
                                </div>
                                
                                <div class="flex gap-1">
                                    {#if currentParticipantId !== p.id}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            class="h-8 w-8 text-muted-foreground hover:text-indigo-600 transition-colors"
                                            onclick={() => handleSwitchIdentity(p.id)}
                                            title={$t('settings.switch_identity')}
                                            aria-label={$t('settings.switch_identity')}
                                        >
                                            <ArrowRightLeft class="h-4 w-4" />
                                        </Button>
                                    {/if}

                                    <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    class="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                    onclick={() => handleDeleteParticipant(p.id)}
                                    disabled={isDeletingParticipant === p.id}
                                    >
                                    {#if isDeletingParticipant === p.id}
                                        <LoaderCircle class="h-4 w-4 animate-spin" />
                                    {:else}
                                        <Trash2 class="h-4 w-4" />
                                    {/if}
                                    </Button>
                                </div>
                            </div>
                        {/each}
                </div>

                <div class="flex gap-2 pt-2 items-center">
                    <div class="flex-1 relative">
                        <Input 
                            placeholder={$t('settings.participants.placeholder')} 
                            bind:value={newParticipantName}
                            class="dark:bg-slate-800 dark:border-slate-700"
                            onkeydown={(e) => e.key === 'Enter' && handleAddParticipant()}
                        />
                        {#if addFeedback === 'added'}
                            <span class="absolute right-3 top-2.5 text-xs text-green-600 font-medium">{$t('settings.participants.added')}</span>
                        {/if}
                    </div>
                    <Button onclick={handleAddParticipant} disabled={isAddingParticipant || !newParticipantName.trim()} aria-label={$t('settings.participants.add')}>
                        {#if isAddingParticipant}
                             ...
                        {:else}
                             <UserPlus class="h-4 w-4" />
                        {/if}
                    </Button>
                </div>
            </div>
        </SettingsSection>
        {/if}

        {#if !installStore.isStandalone && (installStore.canInstall || installStore.isIOS)}
            <SettingsSection title={$t('settings.install.title')} icon={Download} class="bg-card/50 backdrop-blur-xs">
                <div class="space-y-4">
                    <div class="flex flex-col gap-2">
                        <p class="text-sm text-muted-foreground dark:text-slate-400">
                             {$t('settings.install.desc_mobile')}
                        </p>
                        <Button 
                            class="w-full justify-start gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" 
                            onclick={() => installStore.install()}
                        >
                            <Download class="h-4 w-4" />
                            {$t('settings.install.button')}
                        </Button>
                    </div>
                </div>
            </SettingsSection>
        {/if}

        <!-- Export Section -->
        <SettingsSection title={$t('settings.export.title')} icon={FileText}>
            <div class="space-y-4">
                <p class="text-sm text-muted-foreground dark:text-slate-400">
                    {$t('settings.export.desc')}
                </p>
                <div class="grid grid-cols-2 gap-3">
                    <Button variant="outline" class="w-full justify-start gap-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" onclick={() => handleExport('csv')}>
                        <Table class="h-4 w-4 text-green-600" />
                        {$t('settings.export.csv')}
                    </Button>
                    <Button variant="outline" class="w-full justify-start gap-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" onclick={() => handleExport('md')}>
                        <FileText class="h-4 w-4 text-indigo-600" />
                        {$t('settings.export.md')}
                    </Button>
                </div>
            </div>
        </SettingsSection>

        {#if !offlineStore.isOffline}
        <!-- Bug Report Section -->
        <SettingsSection title={$t('settings.bug_report.title')} icon={Bug}>
            <div class="space-y-4">
                <p class="text-sm text-muted-foreground dark:text-slate-400">
                    {$t('settings.bug_report.desc')}
                </p>
                <Button
                    href="https://github.com/dim4k/kimpay/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    class="w-full justify-start gap-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <Bug class="h-4 w-4" />
                    {$t('settings.bug_report.button')}
                </Button>
            </div>
        </SettingsSection>
        {/if}

        <SettingsSection title={$t('settings.actions.title')}>
            
            <div class="space-y-4">
                <div class="flex flex-col gap-2">
                    <p class="text-sm text-muted-foreground dark:text-slate-400">{$t('settings.actions.remove_desc')}</p>
                    <Button variant="outline" class="w-full justify-start gap-2 text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800" onclick={requestLeave} disabled={offlineStore.isOffline}>
                        <LogOut class="h-4 w-4" />
                        {$t('settings.leave_group')}
                    </Button>
                </div>

                {#if isCreator}
                    <div class="pt-4 border-t">
                        <div class="flex flex-col gap-2">
                            <h3 class="font-semibold text-red-600 flex items-center gap-2">
                                <Trash2 class="h-4 w-4" /> 
                                {$t('settings.danger_zone')}
                            </h3>
                            <p class="text-sm text-muted-foreground dark:text-slate-400">{$t('settings.actions.delete_desc')}</p>
                            <Button variant="destructive" class="w-full justify-start gap-2" onclick={requestDelete} disabled={offlineStore.isOffline}>
                                <Trash2 class="h-4 w-4" />
                                {$t('settings.delete_group')}
                            </Button>
                        </div>
                    </div>
                {/if}
            </div>
        </SettingsSection>
        
        <div class="text-center text-xs text-muted-foreground pt-2">
            Kimpay v{__APP_VERSION__}
        </div>
</div>
