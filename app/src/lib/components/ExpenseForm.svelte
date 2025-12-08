<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { pb } from '$lib/pocketbase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Check, Camera, X } from "lucide-svelte";
  import EmojiInput from '$lib/components/ui/EmojiInput.svelte';
  import InputModal from '$lib/components/ui/InputModal.svelte';
  import DatePicker from '$lib/components/ui/DatePicker.svelte';
  import { t } from '$lib/i18n';
  import { addParticipant } from '$lib/api';
  import { DEFAULT_EXPENSE_EMOJI } from '$lib/constants';

  let { kimpayId, initialData = null } = $props();

  // Initialize state with defaults
  let description = $state("");
  let amount = $state("");
  let icon = $state(DEFAULT_EXPENSE_EMOJI);
  let date = $state(new Date().toISOString().split('T')[0]);
  let payer = $state("");
  let involved = $state<string[]>([]);
  
  let participants = $state<any[]>([]);
  let isLoading = $state(false);

  // Photo State
  let newPhotos = $state<File[]>([]);
  let existingPhotos = $state<string[]>([]);
  let photosToDelete = $state<string[]>([]);
  let photoPreviews = $state<string[]>([]); // For new photos only
  let fileInput: HTMLInputElement;

  // New Participant Modal State
  let showNewParticipantModal = $state(false);
  let isAddingParticipant = $state(false);

  onMount(async () => {
      // Seed state from initialData if present
      if (initialData) {
         description = initialData.description || "";
         amount = initialData.amount || "";
         icon = initialData.icon || DEFAULT_EXPENSE_EMOJI;
         date = initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
         payer = initialData.payer || "";
         involved = initialData.involved || [];
         
         
         // Load existing photos
         if (initialData.photos && Array.isArray(initialData.photos)) {
             existingPhotos = initialData.photos;
         }
      }

      try {
          const res = await pb.collection('kimpays').getOne(kimpayId, {
            expand: 'participants_via_kimpay'
          });
          participants = res.expand ? (res.expand['participants_via_kimpay'] || []) : [];
          // Sort manually since we can't sort via expand easily without a view
          participants.sort((a,b) => a.name.localeCompare(b.name));
      } catch (e) {
         console.error(e);
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
  });

  function toggleInvolved(participantId: string) {
      if (involved.includes(participantId)) {
          if (involved.length > 1) {
              involved = involved.filter(id => id !== participantId);
          }
      } else {
          involved = [...involved, participantId];
      }
  }

  function toggleAll() {
      if (involved.length === participants.length) {
          involved = [];
      } else {
          involved = participants.map(p => p.id);
      }
  }

  function goBack() {
      goto(`/k/${kimpayId}`);
  }

  function handleFileSelect(e: Event) {
      const target = e.target as HTMLInputElement;
      if (target.files) {
          const files = Array.from(target.files);
          newPhotos = [...newPhotos, ...files];
          
          // Create new previews
          const newPreviews = files.map(file => URL.createObjectURL(file));
          photoPreviews = [...photoPreviews, ...newPreviews];
          
          // Reset input to allow selecting the same file again if needed (though we just added it)
          target.value = "";
      }
  }

  function removeNewPhoto(index: number) {
      newPhotos = newPhotos.filter((_, i) => i !== index);
      URL.revokeObjectURL(photoPreviews[index]); // Cleanup memory
      photoPreviews = photoPreviews.filter((_, i) => i !== index);
  }

  function removeExistingPhoto(filename: string) {
      existingPhotos = existingPhotos.filter(p => p !== filename);
      photosToDelete = [...photosToDelete, filename];
  }

  function getExistingPhotoUrl(filename: string) {
      if (!initialData?.id || !initialData?.collectionId) return "";
      return pb.files.getURL(initialData, filename, { thumb: '100x100' });
  }



  async function handleNewParticipant(name: string) {
      isAddingParticipant = true;
      try {
          const newP = await addParticipant(kimpayId, name);
          
          // Refresh participants list
           // Refresh participants list via GetOne
           const res = await pb.collection('kimpays').getOne(kimpayId, {
              expand: 'participants_via_kimpay'
           });
           participants = res.expand ? (res.expand['participants_via_kimpay'] || []) : [];
           participants.sort((a,b) => a.name.localeCompare(b.name));

          // Auto-select new participant
          payer = newP.id;
          
          // Auto-add to involved
          if (!involved.includes(newP.id)) {
              involved = [...involved, newP.id];
          }
          
          showNewParticipantModal = false;
      } catch (e) {
          console.error(e);
          alert("Failed to create participant");
      } finally {
          isAddingParticipant = false;
      }
  }

  async function save() {
      if (!description || !amount || !payer || involved.length === 0) return;
      isLoading = true;
      try {
          // 1. Handle Deletions (Edit Mode)
          if (initialData?.id && photosToDelete.length > 0) {
              const formData = new FormData();
              // To remove specific, usage is tricky with FormData + PB.
              // We rely on "photos-" key pattern supported by PB.
          }
          
          const formData = new FormData();
          formData.append('kimpay', kimpayId);
          formData.append('description', description);
          formData.append('amount', amount);
          formData.append('icon', icon);
          formData.append('date', date);
          formData.append('payer', payer);
          formData.append('created_by', payer);

          involved.forEach(id => formData.append('involved', id));

          // Append New Photos
          if (newPhotos.length > 0) {
              for (let i = 0; i < newPhotos.length; i++) {
                  formData.append('photos', newPhotos[i]);
              }
          }
          
          // Handle deletions via special key "photos-"
          if (photosToDelete.length > 0) {
              photosToDelete.forEach(filename => {
                  formData.append('photos-', filename); 
              });
          }
          
          if (initialData?.id) {
               await pb.collection('expenses').update(initialData.id, formData);
          } else {
               await pb.collection('expenses').create(formData);
          }
           goto(`/k/${kimpayId}`);
      } catch (e) {
          console.error(e);
          alert("Error saving expense");
      } finally {
          isLoading = false;
      }
  }
</script>

<div class="space-y-6">
    <div class="space-y-2">
        <Label>{$t('expense.form.desc_label')}</Label>
        <div class="flex gap-2">
            <div class="shrink-0">
                <EmojiInput bind:value={icon} />
            </div>
            <Input bind:value={description} placeholder={$t('expense.form.desc_placeholder')} />
        </div>
    </div>
    
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
                    if (parts[1].length > 2) el.value = `${parts[0]}.${parts[1].slice(0, 2)}`;
                }
            }}
        />
    </div>


    <div class="space-y-3">
        <Label>{$t('expense.form.paid_by_label')}</Label>
        <div class="flex flex-wrap gap-2">
            {#each participants as p}
                <button 
                  onclick={() => { payer = p.id; }}
                  class="relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border {payer === p.id ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground'}"
                >
                    {p.name}
                </button>
            {/each}
            
            <button 
                onclick={() => showNewParticipantModal = true}
                class="px-4 py-2 rounded-full text-sm font-bold border border-dashed border-input text-muted-foreground hover:text-primary hover:border-primary hover:bg-accent transition-colors flex items-center gap-1"
                aria-label={$t('expense.form.paid_by_new')}
            >
                +
            </button>
        </div>
    </div>

    <div class="space-y-3">
        <div class="flex items-center justify-between">
          <Label class="text-base font-semibold">{$t('expense.form.for_whom_label')} <span class="text-muted-foreground font-normal ml-1">({involved.length})</span></Label>
          <button onclick={toggleAll} class="text-sm text-primary font-medium hover:underline">
              {involved.length === participants.length ? $t('expense.form.select_none') : $t('expense.form.select_all')}
          </button>
        </div>
        
        <div class="flex flex-wrap gap-2">
            {#each participants as p}
                <button 
                  onclick={() => toggleInvolved(p.id)}
                  class="relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border {involved.includes(p.id) ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground'}"
                >
                      {p.name}
                </button>
            {/each}
            
            <button 
                onclick={() => showNewParticipantModal = true}
                class="px-4 py-2 rounded-full text-sm font-bold border border-dashed border-input text-muted-foreground hover:text-primary hover:border-primary hover:bg-accent transition-colors flex items-center gap-1"
                aria-label={$t('expense.form.paid_by_new')}
            >
                +
            </button>
        </div>
        {#if involved.length === 0}
          <p class="text-xs text-destructive font-medium">{$t('expense.form.error_select_one')}</p>
        {/if}
    </div>

    <div class="space-y-2">
         <Label>{$t('expense.form.date_label')}</Label>
         <DatePicker bind:value={date} />
    </div>

    <!-- Photo Input -->
    <div class="space-y-2">
        <Label>{$t('expense.form.photos_label')}</Label>
        
        <!-- Existing Photos (Edit Mode) -->
        {#if existingPhotos.length > 0}
            <div class="flex gap-2 overflow-x-auto pb-2">
                {#each existingPhotos as filename}
                    <div class="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 group">
                        <img 
                            src={getExistingPhotoUrl(filename)} 
                            alt="Existing attachment" 
                            class="w-full h-full object-cover" 
                        />
                        <button 
                            type="button"
                            onclick={() => removeExistingPhoto(filename)}
                            class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove photo"
                        >
                            <X class="h-3 w-3" />
                        </button>
                    </div>
                {/each}
            </div>
        {/if}

        <!-- New Photos -->
        {#if photoPreviews.length > 0}
            <div class="flex gap-2 overflow-x-auto pb-2">
                {#each photoPreviews as preview, i}
                    <div class="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        <img src={preview} alt="New Upload" class="w-full h-full object-cover" />
                        <button 
                            type="button"
                            onclick={() => removeNewPhoto(i)}
                            class="absolute top-1 right-1 bg-slate-900/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors"
                            aria-label="Remove photo"
                        >
                            <X class="h-3 w-3" />
                        </button>
                    </div>
                {/each}
            </div>
        {/if}

        <button 
            onclick={() => fileInput.click()}
            class="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-primary hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-[0.98]"
        >
            <Camera class="h-5 w-5" />
            <span class="font-medium">{$t('expense.form.add_photos')}</span>
        </button>
        <input 
            type="file" 
            accept="image/*" 
            multiple 
            class="hidden" 
            bind:this={fileInput}
            onchange={handleFileSelect}
            capture="environment"
        />
    </div>

     <div class="pt-4 grid grid-cols-2 gap-3">
        <Button variant="outline" class="w-full" size="lg" onclick={goBack} disabled={isLoading}>
            {$t('common.cancel')}
        </Button>
         <Button onclick={save} class="w-full" size="lg" disabled={isLoading || involved.length === 0 || !amount || !description || !payer}>
            {isLoading ? $t('common.loading') : (initialData ? $t('expense.form.update_button') : $t('expense.form.save_button'))}
        </Button>
     </div>

    <InputModal 
        isOpen={showNewParticipantModal}
        title={$t('modal.add_participant.title')}
        placeholder={$t('modal.add_participant.placeholder')}
        confirmText={$t('modal.add_participant.confirm')}
        cancelText={$t('common.cancel')}
        isProcessing={isAddingParticipant}
        onConfirm={handleNewParticipant}
        onCancel={() => showNewParticipantModal = false}
    />
</div>
