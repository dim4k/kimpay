<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { onMount, getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import EmojiInput from '$lib/components/ui/EmojiInput.svelte';
  import InputModal from '$lib/components/ui/modals/InputModal.svelte';
  import DatePicker from '$lib/components/ui/DatePicker.svelte';
  import PhotoManager from '$lib/components/PhotoManager.svelte';
  import ParticipantSelector from '$lib/components/ParticipantSelector.svelte';
  import { t } from '$lib/i18n';
  import { DEFAULT_EXPENSE_EMOJI } from '$lib/constants';

  import { offlineService } from '$lib/services/offline.svelte';
  import { storageService } from '$lib/services/storage';
  import { fabState } from '$lib/stores/fab.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import { Check, LoaderCircle, ChevronDown } from "lucide-svelte";
  import type { ActiveKimpay } from '$lib/stores/activeKimpay.svelte';
  import { CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY } from '$lib/services/currency';
  import { slide } from 'svelte/transition';

  let { kimpayId, initialData = null } = $props();

  // Get ActiveKimpay
  const ctx = getContext<{ value: ActiveKimpay }>('ACTIVE_KIMPAY');
  let activeKimpay = $derived(ctx.value);

  // Derive default currency from Kimpay
  let kimpayData = $derived(activeKimpay?.kimpay);
  let defaultCurrency = $derived(kimpayData?.currency ?? DEFAULT_CURRENCY);

  // Form State
  let description = $state("");
  let amount = $state("");
  let icon = $state(DEFAULT_EXPENSE_EMOJI);
  let date = $state(new Date().toISOString().slice(0, 10));
  let payer = $state("");
  let involved = $state<string[]>([]);
  let currency = $state("");
  let isCurrencyOpen = $state(false);
  
  let participants = $derived(activeKimpay?.participants || []);
  let isLoading = $state(false);

  // Photo State (managed by PhotoManager)
  let newPhotos = $state<File[]>([]);
  let existingPhotos = $state<string[]>([]);
  let photosToDelete = $state<string[]>([]);

  // New Participant Modal State
  let newParticipantSource = $state<string | null>(null);
  let isAddingParticipant = $state(false);

  onMount(async () => {
      // Seed state from initialData if present
      if (initialData) {
         description = initialData.description || "";
         amount = initialData.amount || "";
         icon = initialData.icon || DEFAULT_EXPENSE_EMOJI;
         date = initialData.date ? new Date(initialData.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
         payer = initialData.payer || "";
         involved = initialData.involved || [];
         currency = initialData.currency || defaultCurrency;
         
         if (initialData.photos && Array.isArray(initialData.photos)) {
             existingPhotos = initialData.photos;
         }
      } else {
         // New expense: use Kimpay currency
         currency = defaultCurrency;
      }
      
      if (!initialData && involved.length === 0) {
          involved = participants.map(p => p.id);
      }

      if (!initialData && !payer) {
          const myId = await storageService.getMyParticipantId(kimpayId);
          if (myId) {
              payer = myId;
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
          const newP = await activeKimpay.addParticipant(name);
          
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
          const expenseData = {
              description,
              amount: parseFloat(amount),
              currency,
              payer,
              involved,
              date: new Date(date).toISOString(),
              icon,
              kimpay: kimpayId
          };

          if (initialData?.id) {
               await activeKimpay.updateExpense(initialData.id, expenseData, newPhotos, photosToDelete);
          } else {
               await activeKimpay.addExpense(expenseData, newPhotos);
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
    
    <!-- Amount & Currency -->
    <div class="space-y-2">
        <Label>{$t('expense.form.amount_label')}</Label>
        <div class="flex gap-2">
            <Input 
                class="text-lg font-semibold flex-1" 
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
            <!-- Currency Selector (compact) -->
            <div class="relative shrink-0">
                <button
                    type="button"
                    onclick={() => isCurrencyOpen = !isCurrencyOpen}
                    class="h-full flex items-center gap-1.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
                >
                    <span class="text-base font-medium">{CURRENCIES[currency]?.symbol ?? '€'}</span>
                    <span class="font-medium text-sm text-slate-700 dark:text-slate-200">{currency || DEFAULT_CURRENCY}</span>
                    <ChevronDown class="h-3.5 w-3.5 text-slate-400 transition-transform {isCurrencyOpen ? 'rotate-180' : ''}" />
                </button>

                {#if isCurrencyOpen}
                    <div class="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto min-w-[120px]" transition:slide={{ duration: 150 }}>
                        {#each CURRENCY_CODES as code (code)}
                            <button
                                type="button"
                                onclick={() => { currency = code; isCurrencyOpen = false; }}
                                class="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm {currency === code ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}"
                            >
                                <div class="flex items-center gap-2">
                                    <span class="text-base w-5 text-center">{CURRENCIES[code]?.symbol}</span>
                                    <span class="font-medium text-slate-900 dark:text-slate-100">{code}</span>
                                </div>
                                {#if currency === code}
                                    <Check class="h-3.5 w-3.5 text-indigo-500" />
                                {/if}
                            </button>
                        {/each}
                    </div>
                    <div 
                        class="fixed inset-0 z-40" 
                        onclick={() => isCurrencyOpen = false} 
                        role="button" 
                        tabindex="-1" 
                        onkeydown={(e) => e.key === 'Escape' && (isCurrencyOpen = false)}
                    ></div>
                {/if}
            </div>
        </div>
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
