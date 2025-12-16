<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { pb } from '$lib/pocketbase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import EmojiInput from '$lib/components/ui/EmojiInput.svelte';
  import InputModal from '$lib/components/ui/InputModal.svelte';
  import DatePicker from '$lib/components/ui/DatePicker.svelte';
  import PhotoManager from '$lib/components/PhotoManager.svelte';
  import ParticipantSelector from '$lib/components/ParticipantSelector.svelte';
  import { t } from '$lib/i18n';
  import { DEFAULT_EXPENSE_EMOJI } from '$lib/constants';

  import { expensesStore } from '$lib/stores/expenses.svelte';
  import { participantsStore } from '$lib/stores/participants.svelte';
  import { kimpayStore } from '$lib/stores/kimpay.svelte';
  import { offlineService } from '$lib/services/offline.svelte';
  import { fabState } from '$lib/stores/fab.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import { Check, LoaderCircle } from "lucide-svelte";

  let { kimpayId, initialData = null } = $props();

  // Form State
  let description = $state("");
  let amount = $state("");
  let icon = $state(DEFAULT_EXPENSE_EMOJI);
  let date = $state(new Date().toISOString().slice(0, 10));
  let payer = $state("");
  let involved = $state<string[]>([]);
  
  let participants = $derived(participantsStore.list);
  let isLoading = $state(false);

  // Photo State (managed by PhotoManager)
  let newPhotos = $state<File[]>([]);
  let existingPhotos = $state<string[]>([]);
  let photosToDelete = $state<string[]>([]);

  // New Participant Modal State
  let newParticipantSource = $state<string | null>(null);
  let isAddingParticipant = $state(false);

  onMount(async () => {
      if (kimpayId) {
          await Promise.all([
             kimpayStore.init(kimpayId),
             participantsStore.init(kimpayId),
             expensesStore.init(kimpayId)
          ]);
      }

      // Seed state from initialData if present
      if (initialData) {
         description = initialData.description || "";
         amount = initialData.amount || "";
         icon = initialData.icon || DEFAULT_EXPENSE_EMOJI;
         date = initialData.date ? new Date(initialData.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
         payer = initialData.payer || "";
         involved = initialData.involved || [];
         
         if (initialData.photos && Array.isArray(initialData.photos)) {
             existingPhotos = initialData.photos;
         }
      }
      
      if (!initialData && involved.length === 0) {
          involved = participants.map(p => p.id);
      }

      if (!initialData && !payer) {
          const myIds = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
          if (myIds[kimpayId]) {
              payer = myIds[kimpayId];
          }
      }

      updateFab();
  });

  // Reactive Update for FAB state
  $effect(() => {
     const _ = { description, amount, payer, involved, isLoading };
     updateFab();
  });

  function updateFab() {
      const isValid = !!description && !!amount && !!payer && involved.length > 0;
      
      fabState.configure({
          icon: (isLoading ? LoaderCircle : Check) as unknown as import('svelte').Component,
          colorClass: isValid 
            ? "bg-green-500 hover:bg-green-600 shadow-green-200 dark:shadow-none" 
            : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-none",
          onClick: save,
          href: null,
          label: (initialData?.id && offlineService.isOffline) 
            ? $t('common.offline') 
            : (initialData ? $t('expense.form.update_button') : $t('expense.form.save_button')),
          disabled: !isValid || isLoading || (!!initialData?.id && offlineService.isOffline)
      });
  }

  async function goBack() {
      await goto(`/k/${kimpayId}`);
  }

  function handlePhotosChange(photos: File[], existing: string[], toDelete: string[]) {
      newPhotos = photos;
      existingPhotos = existing;
      photosToDelete = toDelete;
  }

  function handlePayerChange(selected: string[]) {
      payer = selected[0] || "";
  }

  function handleInvolvedChange(selected: string[]) {
      involved = selected;
  }

  async function handleNewParticipant(name: string) {
      isAddingParticipant = true;
      try {
          await participantsStore.create(kimpayId, name);
          const newP = participantsStore.list.find(p => p.name === name);
          
          if (newP) {
             if (newParticipantSource === 'payer') {
                 payer = newP.id;
             }
             
             if (!involved.includes(newP.id)) {
                 involved = [...involved, newP.id];
             }
          }
          
          newParticipantSource = null;
      } catch (e) {
          console.error(e);
          modals.alert({ message: "Failed to create participant", title: "Error" });
      } finally {
          isAddingParticipant = false;
      }
  }

  async function save() {
      if (!description || !amount || !payer || involved.length === 0) return;
      
      if (initialData?.id && offlineService.isOffline) {
          modals.alert({ 
              message: $t('common.offline_edit_error') || "Cannot edit expenses while offline",
              title: "Offline"
          });
          return;
      }

      isLoading = true;
      try {
          const formData = new FormData();
          formData.append('kimpay', kimpayId);
          formData.append('description', description);
          formData.append('amount', amount);
          formData.append('icon', icon || DEFAULT_EXPENSE_EMOJI);
          formData.append('date', date ?? new Date().toISOString().slice(0, 10));
          formData.append('payer', payer);
          formData.append('created_by', payer);

          involved.forEach(id => formData.append('involved', id));

          // Append New Photos (only if online)
          if (newPhotos.length > 0 && !offlineService.isOffline) {
              const photoKey = initialData?.id ? 'photos+' : 'photos';
              for (let i = 0; i < newPhotos.length; i++) {
                  const file = newPhotos[i];
                  if (file) formData.append(photoKey, file);
              }
          }
          
          // Handle deletions
          if (photosToDelete.length > 0) {
              photosToDelete.forEach(filename => {
                  formData.append('photos-', filename); 
              });
          }
          
          if (initialData?.id) {
               await pb.collection('expenses').update(initialData.id, formData);
               await pb.collection('kimpays').update(kimpayId, { updated: new Date() });
          } else {
               await expensesStore.create(formData, participantsStore.list);
               
               if (!offlineService.isOffline) {
                   await pb.collection('kimpays').update(kimpayId, { updated: new Date() });
               }
          }
          
          await goto(`/k/${kimpayId}`);
      } catch (e) {
          console.error(e);
          modals.alert({ message: "Error saving expense", title: "Error" });
      } finally {
          isLoading = false;
      }
  }
</script>

<div class="space-y-6">
    <!-- Description & Icon -->
    <div class="space-y-2">
        <Label>{$t('expense.form.desc_label')}</Label>
        <div class="flex gap-2">
            <div class="shrink-0">
                <EmojiInput bind:value={icon} />
            </div>
            <Input bind:value={description} placeholder={$t('expense.form.desc_placeholder')} />
        </div>
    </div>
    
    <!-- Amount -->
    <div class="space-y-2">
        <Label>{$t('expense.form.amount_label')}</Label>
        <Input 
            class="text-lg font-semibold" 
            type="number" 
            step="0.01" 
            bind:value={amount} 
            placeholder={$t('expense.form.amount_placeholder')}
            max="99999"
            oninput={(e) => {
                const el = e.target as HTMLInputElement;
                if (el.value.length > 8) el.value = el.value.slice(0, 8);
                if (el.value.includes('.')) {
                    const parts = el.value.split('.');
                    if (parts[1] && parts[1].length > 2) el.value = `${parts[0]}.${parts[1].slice(0, 2)}`;
                }
            }}
        />
    </div>

    <!-- Paid By (Payer) -->
    <ParticipantSelector
        {participants}
        selected={payer ? [payer] : []}
        mode="single"
        label={$t('expense.form.paid_by_label')}
        onSelectionChange={handlePayerChange}
        onAddNew={() => newParticipantSource = 'payer'}
    />

    <!-- For Whom (Involved) -->
    <ParticipantSelector
        {participants}
        selected={involved}
        mode="multi"
        label={$t('expense.form.for_whom_label')}
        onSelectionChange={handleInvolvedChange}
        onAddNew={() => newParticipantSource = 'involved'}
        showToggleAll={true}
    />

    <!-- Date -->
    <div class="space-y-2">
         <Label>{$t('expense.form.date_label')}</Label>
         <DatePicker bind:value={date} />
    </div>

    <!-- Photos -->
    <PhotoManager 
        bind:existingPhotos
        record={initialData}
        onPhotosChange={handlePhotosChange}
    />

     <!-- Action Buttons -->
     <div class="pt-4 grid grid-cols-2 gap-3">
         <Button variant="outline" class="w-full" size="lg" onclick={goBack} disabled={isLoading}>
            {$t('common.cancel')}
        </Button>
         <Button onclick={save} class="w-full" size="lg" disabled={isLoading || involved.length === 0 || !amount || !description || !payer}>
            {isLoading ? $t('common.loading') : (initialData ? $t('expense.form.update_button') : $t('expense.form.save_button'))}
        </Button>
     </div>

    <!-- Add Participant Modal -->
    <InputModal 
        isOpen={!!newParticipantSource}
        title={$t('modal.add_participant.title')}
        placeholder={$t('modal.add_participant.placeholder')}
        confirmText={$t('modal.add_participant.confirm')}
        cancelText={$t('common.cancel')}
        isProcessing={isAddingParticipant}
        onConfirm={handleNewParticipant}
        onCancel={() => newParticipantSource = null}
    />
</div>
