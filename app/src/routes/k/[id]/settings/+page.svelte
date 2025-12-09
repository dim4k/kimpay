<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve */
  import { page } from '$app/stores';
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { deleteKimpay, updateKimpay, addParticipant } from '$lib/api';
  import { pb } from '$lib/pocketbase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { LogOut, Trash2, Save, UserPlus, Users, ArrowRightLeft } from "lucide-svelte";
  import { modals } from '$lib/stores/modals';
  import { t } from '$lib/i18n';
  import { installPrompt, install } from '$lib/stores/install';
  import { Download, FileText, Table } from 'lucide-svelte';
  import { appState } from '$lib/stores/appState.svelte';
  
  import { KIMPAY_EMOJIS, DEFAULT_KIMPAY_EMOJI } from '$lib/constants';
  import type { RecentKimpay } from '$lib/types';
  
  let kimpayId = $derived($page.params.id ?? '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let kimpay = $state<any>(null);
  let currentParticipantId = $state<string | null>(null);
  let isCreator = $state(false);

  // Edit State
  let editName = $state("");
  let editIcon = $state("");
  let isEditing = $state(false);
  
  // Feedback State
  let saveFeedback = $state("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let participants = $state<any[]>([]);

  async function loadParticipants() {
      try {
           const res = await pb.collection('kimpays').getOne(kimpayId, {
               expand: 'participants_via_kimpay',
               requestKey: null
           });
           participants = res.expand ? (res.expand['participants_via_kimpay'] || []) : [];
           return res;
      } catch (e) {
          console.error("Failed to load participants", e);
          return null;
      }
  }

  async function checkUsage(pId: string): Promise<boolean> {
      try {
          const res = await pb.collection('kimpays').getOne(kimpayId, {
               expand: 'expenses_via_kimpay'
          });
          const allExpenses = res.expand ? (res.expand['expenses_via_kimpay'] || []) : [];
          return allExpenses.some((e: { payer: string; involved?: string[] }) => e.payer === pId || (e.involved && e.involved.includes(pId)));
      } catch(e) {
          console.warn("Could not check expenses", e);
          return true; // Fail safe
      }
  }

  onMount(async () => {
      try {
          // 1. Get Kimpay info & Participants
          const res = await loadParticipants();
          
          if (res) {
              kimpay = res;
              editName = kimpay.name;
              editIcon = kimpay.icon || DEFAULT_KIMPAY_EMOJI;
          }

          const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
          currentParticipantId = myKimpays[kimpayId];
          
          if (kimpay && currentParticipantId) {
              isCreator = kimpay.created_by === currentParticipantId;
          }
      } catch (e) {
          console.error("Error loading settings", e);
      }
  });

  async function handleSave() {
      saveFeedback = "";
      try {
          const updatedKimpay = await updateKimpay(kimpayId, {
              name: editName,
              icon: editIcon
          });
          
          // Update store
          appState.updateRecentKimpay(updatedKimpay as unknown as RecentKimpay);

          saveFeedback = "updated";
          setTimeout(() => saveFeedback = "", 2000);
      } catch (e) {
          console.error("Error updating", e);
          alert("Failed to update");
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
          await addParticipant(kimpayId, newParticipantName);
          newParticipantName = "";
          addFeedback = "added";
          setTimeout(() => addFeedback = "", 2000);
          
          await loadParticipants();
      } catch(e) {
          console.error(e);
          alert("Failed to add participant");
      } finally {
          isAddingParticipant = false;
      }
  }
  
  async function handleDeleteParticipant(pId: string) {
      isDeletingParticipant = pId;
      try {
           // Check for usage in expenses (Client-side check)
           const isUsed = await checkUsage(pId);
           
           if (isUsed) {
               modals.alert({ message: $t('error.participant.used') });
               isDeletingParticipant = null;
               return;
           }
           
           modals.confirm({
               title: 'Delete Participant?',
               description: $t('modal.delete_participant.confirm'),
               confirmText: $t('common.delete'),
               variant: 'destructive',
               onConfirm: async () => {
                   const isSelf = pId === currentParticipantId;
                   await pb.collection('participants').delete(pId);
                   if (isSelf) {
                       const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
                       delete myKimpays[kimpayId];
                       localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));
                       localStorage.removeItem(`kimpay_user_${kimpayId}`);
                       window.location.reload();
                   } else {
                       await loadParticipants();
                       isDeletingParticipant = null;
                   }
               },
               onCancel: () => { isDeletingParticipant = null; }
           });
      } catch (e) {
          console.error(e);
          modals.alert({ message: "Failed to check participant usage" });
          isDeletingParticipant = null;
      }
  }

  function requestLeave() {
      modals.confirm({
          title: $t('modal.leave.title'),
          description: $t('modal.leave.desc'),
          confirmText: $t('modal.leave.confirm'),
          cancelText: $t('common.cancel'),
          variant: 'destructive',
          onConfirm: async () => {
             // Safe Delete Logic
             const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
             const participantId = currentParticipantId; 
             let canDelete = true;

             if (isCreator) canDelete = false;

             if (canDelete && participantId) {
                 const isUsed = await checkUsage(participantId);
                 if (isUsed) canDelete = false;
             }
             
             if (canDelete && participantId) {
                 try {
                     await pb.collection('participants').delete(participantId);
                 } catch (e) {
                     console.warn("Could not delete participant from server", e);
                 }
             }

            delete myKimpays[kimpayId];
            localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));
            localStorage.removeItem(`kimpay_user_${kimpayId}`);
            await goto('/');
          }
      });
  }

  function requestDelete() {
      modals.confirm({
          title: $t('settings.delete_group'),
          description: $t('settings.actions.delete_warning'),
          confirmText: $t('common.delete'),
          variant: 'destructive',
          onConfirm: async () => {
            await deleteKimpay(kimpayId);
            const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
            delete myKimpays[kimpayId];
            localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));
            localStorage.removeItem(`kimpay_user_${kimpayId}`);
            await goto('/');
          }
      });
  }

  function handleSwitchIdentity(pId: string) {
      modals.confirm({
          title: $t('settings.switch_identity'),
          description: $t('settings.switch_modal.desc'),
          confirmText: $t('common.save'), // or 'Switch'
          onConfirm: () => {
              localStorage.setItem(`kimpay_user_${kimpayId}`, pId);
              
              const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
              myKimpays[kimpayId] = pId;
              localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));

              window.location.reload(); 
          }
      });
  }

  async function handleExport(format: 'csv' | 'md') {
      try {
          const res = await pb.collection('kimpays').getOne(kimpayId, {
              expand: 'expenses_via_kimpay.payer,expenses_via_kimpay.involved,participants_via_kimpay'
          });
          
          const expenses = res.expand ? (res.expand['expenses_via_kimpay'] || []) : [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expenses.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          const participantsList = res.expand ? (res.expand['participants_via_kimpay'] || []) : [];
          // Map for quick lookup
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const participantMap = new Map(participantsList.map((p: any) => [p.id, p.name]));
          
          let content = "";
          const filename = `kimpay_${res.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.${format}`;

          if (format === 'csv') {
              // CSV Header
              content += `${$t('export.col.date')},${$t('export.col.desc')},${$t('export.col.amount')},${$t('export.col.payer')},${$t('export.col.for')}\n`;
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              expenses.forEach((e: any) => {
                  const date = new Date(e.date).toLocaleDateString();
                  const desc = `"${(e.description || '').replace(/"/g, '""')}"`;
                  const amount = e.amount.toFixed(2);
                  const payer = e.expand?.payer?.name || $t('common.unknown');
                  
                  // Get Involved Names
                  const involvedIds = e.involved || [];
                  const involvedNames = involvedIds.map((id: string) => participantMap.get(id) || $t('common.unknown')).join('; ');
                  const involvedField = `"${involvedNames.replace(/"/g, '""')}"`;

                  content += `${date},${desc},${amount},${payer},${involvedField}\n`;
              });
          } else {
              // Markdown
              content += `# ${res.icon || ''} ${res.name}\n\n`;
              content += `**${$t('export.meta.date')}:** ${new Date().toLocaleDateString()}\n`;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content += `**${$t('export.meta.participants')}:** ${participantsList.map((p: any) => p.name).join(', ')}\n\n`;
              
              content += `## ${$t('export.meta.expenses')}\n\n`;
              content += `| Icon | ${$t('export.col.date')} | ${$t('export.col.desc')} | ${$t('export.col.amount')} | ${$t('export.col.payer')} | ${$t('export.col.for')} |\n`;
              content += `|:---:|---|---|---|---|---|\n`;
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
              const participantsNames = participantsList.map((p: any) => p.name).join(', '); // Not suppressed here? Wait, participantsList uses any above?

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              expenses.forEach((e: any) => {
                  const icon = e.icon || '💸';
                  const date = new Date(e.date).toLocaleDateString();
                  const desc = (e.description || '').replace(/\|/g, '-'); 
                  const amount = `${e.amount.toFixed(2)} €`;
                  const payer = e.expand?.payer?.name || $t('common.unknown');
                  
                  const involvedIds = e.involved || [];
                  const involvedNames = involvedIds.map((id: string) => participantMap.get(id) || $t('common.unknown')).join(', ');

                  content += `| ${icon} | ${date} | ${desc} | ${amount} | ${payer} | ${involvedNames} |\n`;
              });
              
              content += `\n\n${$t('export.footer')}\n`;
          }

          // Trigger Download
          const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

      } catch (e) {
          console.error("Export failed", e);
          modals.alert({ message: "Failed to export data" });
      }
  }
</script>

<div class="flex flex-col bg-slate-50 dark:bg-background transition-colors">
    <main class="container p-4 space-y-6">
        <header class="space-y-1">
            <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 w-fit">{$t('settings.title')}</h1>
            <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">{$t('settings.subtitle')}</p>
        </header>

        <!-- Edit Section -->
        <div class="bg-card p-6 rounded-xl border shadow-sm space-y-6 transition-colors animate-pop-in relative z-20">
            <h2 class="font-semibold text-lg border-b dark:border-slate-800 pb-2 dark:text-slate-100">{$t('settings.edit_group')}</h2>
            <div class="space-y-4">
                <div class="space-y-2">
                    <Label for="name">{$t('home.create.name_label')}</Label>
                    <div class="flex gap-2">
                        <div class="relative">
                            <Input 
                                class="w-14 text-center text-xl p-0 cursor-pointer selection:bg-transparent dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700" 
                                value={editIcon} 
                                readonly 
                                onclick={() => isEditing = !isEditing} 
                            />
                            
                            {#if isEditing}
                                <div class="absolute top-full mt-2 left-0 z-50 w-64 bg-white dark:bg-slate-900 rounded-lg shadow-xl border dark:border-slate-800 p-2 grid grid-cols-5 gap-2">
                                    {#each KIMPAY_EMOJIS as emoji (emoji)}
                                        <button 
                                            class="aspect-square hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-xl flex items-center justify-center transition-colors"
                                            onclick={() => {
                                                editIcon = emoji;
                                                isEditing = false;
                                            }}
                                        >
                                            {emoji}
                                        </button>
                                    {/each}
                                </div>
                                <div 
                                    class="fixed inset-0 z-40" 
                                    onclick={() => isEditing = false} 
                                    role="button" 
                                    tabindex="-1" 
                                    onkeydown={(e) => e.key === 'Escape' && (isEditing = false)}
                                ></div>
                            {/if}
                        </div>
                        <Input id="name" bind:value={editName} class="dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700" />
                        <Button onclick={handleSave} size="icon" class="shrink-0 relative">
                            {#if saveFeedback === 'updated'}
                                <span class="absolute -top-8 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow animate-in fade-in slide-in-from-bottom-2">
                                    {$t('common.save')}d!
                                </span>
                            {/if}
                            <Save class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Participants Section -->
        <div class="bg-card p-6 rounded-xl border shadow-sm space-y-6 transition-colors animate-pop-in">
            <h2 class="font-semibold text-lg border-b dark:border-slate-800 pb-2 dark:text-slate-100 flex items-center gap-2">
                 <Users class="h-4 w-4" />
                 {$t('settings.participants')}
            </h2>
             <div class="space-y-4">
                <div class="space-y-2">
                        {#each participants as p (p.id)}
                            <div class="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700 group">
                                <div class="flex items-center gap-3">
                                <div class="w-8 h-8 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                    {p.name.slice(0, 2).toUpperCase()}
                                </div>
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
                                        <span class="loading loading-spinner loading-xs">...</span>
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
                            <span class="absolute right-3 top-2.5 text-xs text-green-600 font-medium animate-in fade-in slide-in-from-bottom-1">{$t('settings.participants.added')}</span>
                        {/if}
                    </div>
                    <Button onclick={handleAddParticipant} disabled={isAddingParticipant || !newParticipantName.trim()}>
                        {#if isAddingParticipant}
                             ...
                        {:else}
                             <UserPlus class="h-4 w-4" />
                        {/if}
                    </Button>
                </div>
            </div>
        </div>

        {#if $installPrompt}
            <div class="bg-card/50 backdrop-blur-sm p-6 rounded-xl border shadow-sm space-y-6 transition-colors animate-pop-in">
                <h2 class="font-semibold text-lg border-b dark:border-slate-800 pb-2 dark:text-slate-100 flex items-center gap-2">
                    <Download class="h-4 w-4" />
                    {$t('settings.install.title')}
                </h2>
                <div class="space-y-4">
                    <div class="flex flex-col gap-2">
                        <p class="text-sm text-muted-foreground dark:text-slate-400">
                             {$t('settings.install.desc')}
                        </p>
                        <Button 
                            class="w-full justify-start gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" 
                            onclick={install}
                        >
                            <Download class="h-4 w-4" />
                            {$t('settings.install.button')}
                        </Button>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Export Section -->
        <div class="bg-card p-6 rounded-xl border shadow-sm space-y-6 transition-colors animate-pop-in">
            <h2 class="font-semibold text-lg border-b dark:border-slate-800 pb-2 dark:text-slate-100 flex items-center gap-2">
                <FileText class="h-4 w-4" />
                {$t('settings.export.title')}
            </h2>
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
        </div>

        <div class="bg-card p-6 rounded-xl border shadow-sm space-y-6 transition-colors animate-pop-in">
            <h2 class="font-semibold text-lg border-b dark:border-slate-800 pb-2 dark:text-slate-100">{$t('settings.actions.title')}</h2>
            
            <div class="space-y-4">
                <div class="flex flex-col gap-2">
                    <p class="text-sm text-muted-foreground dark:text-slate-400">{$t('settings.actions.remove_desc')}</p>
                    <Button variant="outline" class="w-full justify-start gap-2 text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800" onclick={requestLeave}>
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
                            <Button variant="destructive" class="w-full justify-start gap-2" onclick={requestDelete}>
                                <Trash2 class="h-4 w-4" />
                                {$t('settings.delete_group')}
                            </Button>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
        
        <div class="text-center text-xs text-muted-foreground pt-2">
            Kimpay Beta v0.1.1
        </div>
    </main>
</div>
