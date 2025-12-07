<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { deleteKimpay, updateKimpay, addParticipant } from '$lib/api';
  import { pb } from '$lib/pocketbase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { LogOut, Trash2, ArrowLeft, Save, UserPlus, Users, ArrowRightLeft } from "lucide-svelte";
  import { modals } from '$lib/stores/modals';
  import { t } from '$lib/i18n';
  
  let kimpayId = $derived($page.params.id);
  let kimpay = $state<any>(null);
  let currentParticipantId = $state<string | null>(null);
  let isCreator = $state(false);

  // Edit State
  let editName = $state("");
  let editIcon = $state("");
  let isEditing = $state(false);
  let isSaving = $state(false);
  
  // Feedback State
  let saveFeedback = $state("");

  const EMOJIS = ["✈️", "🏠", "🍕", "🍻", "🎁", "⚽", "🚗", "💼", "🎉", "💸", "🍔", "🍺", "🏖️", "🏔️", "🚆", "💊", "🛒", "🎬", "🎤", "🎮"];

  let participants = $state<any[]>([]);

  async function loadParticipants() {
      try {
           participants = await pb.collection('participants').getFullList({
              filter: `kimpay="${kimpayId}"`
           });
      } catch (e) {
          console.error("Failed to load participants", e);
      }
  }

  onMount(async () => {
      try {
          // 1. Get Kimpay info
          kimpay = await pb.collection('kimpays').getOne(kimpayId);
          
          editName = kimpay.name;
          editIcon = kimpay.icon || "✈️";

          // 2. Get Participants explicitely
          await loadParticipants();

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
      isSaving = true;
      saveFeedback = "";
      try {
          await updateKimpay(kimpayId, {
              name: editName,
              icon: editIcon
          });
          saveFeedback = "updated";
          setTimeout(() => saveFeedback = "", 2000);
      } catch (e) {
          console.error("Error updating", e);
          alert("Failed to update");
      } finally {
          isSaving = false;
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
           // Check for usage in expenses
           const used = await pb.collection('expenses').getList(1, 1, {
               filter: `kimpay="${kimpayId}" && (payer="${pId}" || involved~"${pId}")`
           });
           
           if (used.totalItems > 0) {
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
                 const expenses = await pb.collection('expenses').getList(1, 1, {
                    filter: `kimpay="${kimpayId}" && (payer="${participantId}" || involved~"${participantId}")`
                 });
                 if (expenses.totalItems > 0) canDelete = false;
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
            goto('/');
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
            goto('/');
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
</script>

<div class="flex flex-col bg-slate-50 dark:bg-background transition-colors">
    <main class="container p-4 space-y-6">
        <header class="space-y-1">
            <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{$t('settings.title')}</h1>
            <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">{$t('settings.subtitle')}</p>
        </header>

        <!-- Edit Section -->
        <div class="bg-card p-6 rounded-xl border shadow-sm space-y-6 transition-colors">
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
                                    {#each EMOJIS as emoji}
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
        <div class="bg-card p-6 rounded-xl border shadow-sm space-y-6 transition-colors">
            <h2 class="font-semibold text-lg border-b dark:border-slate-800 pb-2 dark:text-slate-100 flex items-center gap-2">
                 <Users class="h-4 w-4" />
                 {$t('settings.participants')}
            </h2>
             <div class="space-y-4">
                <div class="space-y-2">
                        {#each participants as p}
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

        <div class="bg-card p-6 rounded-xl border shadow-sm space-y-6 transition-colors">
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
        
        <div class="text-center text-xs text-muted-foreground pt-10">
            Kimpay v0.1.1
        </div>
    </main>
</div>
