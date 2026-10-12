<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import { onMount } from 'svelte';
  import { goBack } from '#lib/utils/navigation.js';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import EmojiInput from '#lib/components/ui/EmojiInput.svelte';
  import InputModal from '#lib/components/ui/modals/InputModal.svelte';
  import DatePicker from '#lib/components/ui/DatePicker.svelte';
  import PhotoManager from '#lib/components/PhotoManager.svelte';
  import ParticipantSelector from '#lib/components/ParticipantSelector.svelte';
  import ReceiptScanner from '#lib/components/ReceiptScanner.svelte';
  import SplitEditor from '#lib/components/expense/SplitEditor.svelte';
  import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
  import { t, locale } from '#lib/i18n.js';
  import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';

  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { LoaderCircle, Trash2, X } from "@lucide/svelte";
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { CURRENCY_CODES, DEFAULT_CURRENCY, formatAmount, getExchangeRateAt } from '#lib/services/currency.js';
  import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { haptic } from '#lib/utils/haptic.js';
  import { notifyError } from '#lib/utils/notify.js';
  import type { Expense, SplitMode } from '#lib/types.js';
  import { toLocalISODate } from '#lib/utils/date.js';
  import { buildSplit, checkSplit } from '#lib/split.js';
  import { findSimilarExpense } from '#lib/utils/suggest.js';

  let {
      kimpayId,
      initialData = null,
      title,
      onDelete,
  }: {
      kimpayId: string;
      initialData?: Expense | null;
      /** Title of the top bar */
      title: string;
      /** Shows a delete button in the top bar (editing) */
      onDelete?: () => void;
  } = $props();

  // Get ActiveKimpay
  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  // Derive default currency from Kimpay
  let kimpayData = $derived(activeKimpay?.kimpay);
  let defaultCurrency = $derived(kimpayData?.currency ?? DEFAULT_CURRENCY);

  // Form State
  let description = $state("");
  let amount = $state("");
  let icon = $state(DEFAULT_EXPENSE_EMOJI);
  let date = $state(toLocalISODate());
  let payer = $state("");
  let involved = $state<string[]>([]);
  let currency = $state(DEFAULT_CURRENCY);
  let isIncome = $state(false);
  let splitMode = $state<SplitMode>('equal');
  let splitValues = $state<Record<string, number>>({});
  
  let participants = $derived(activeKimpay?.participants || []);
  let involvedParticipants = $derived(participants.filter(p => involved.includes(p.id)));
  // Typed as text (decimal keyboard, "," or "." as separator).
  let amountValue = $derived(parseFloat(amount.replace(',', '.')) || 0);
  let splitCheck = $derived(checkSplit(splitMode, splitValues, involved, amountValue, currency));
  let isLoading = $state(false);

  // Photo State (managed by PhotoManager)
  let newPhotos = $state<File[]>([]);
  let existingPhotos = $state<string[]>([]);
  let photosToDelete = $state<string[]>([]);

  // New Participant Modal State
  let newParticipantSource = $state<string | null>(null);
  let isAddingParticipant = $state(false);

  onMount(() => {
      // Seed state from initialData if present
      if (initialData) {
         description = initialData.description || "";
         amount = initialData.amount ? String(initialData.amount) : "";
         icon = initialData.icon || DEFAULT_EXPENSE_EMOJI;
         date = initialData.date ? initialData.date.slice(0, 10) : toLocalISODate();
         payer = initialData.payer || "";
         involved = initialData.involved || [];
         currency = initialData.currency || defaultCurrency;
         isIncome = !!initialData.is_income;
         if (initialData.split && initialData.split.mode !== 'equal') {
             splitMode = initialData.split.mode;
             splitValues = { ...initialData.split.values };
         }
         
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

      if (!initialData && !payer && activeKimpay?.myParticipantId) {
          payer = activeKimpay.myParticipantId;
      }

  });

  let isValid = $derived(!!description && amountValue > 0 && !!payer && involved.length > 0 && splitCheck.valid);
  // Expenses cannot be edited offline (only created).
  let isOfflineEdit = $derived(!!initialData?.id && offlineStore.isOffline);

  let saveLabel = $derived.by(() => {
      if (isOfflineEdit) return $t('common.offline');
      const action = initialData ? $t('expense.form.update_button') : $t('expense.form.save_button');
      return amountValue > 0 ? `${action} · ${formatAmount(amountValue, currency, $locale)}` : action;
  });

  /** Digits and one decimal separator, at most 8 digits and 2 decimals. */
  function sanitizeAmount(e: Event) {
      const el = e.currentTarget as HTMLInputElement;
      const raw = el.value.replace(/[^\d.,]/g, '');
      const sep = raw.search(/[.,]/);
      const clean = sep === -1
          ? raw.slice(0, 8)
          : raw.slice(0, sep).slice(0, 8) + raw[sep] + raw.slice(sep + 1).replace(/[.,]/g, '').slice(0, 2);
      if (clean !== el.value) el.value = clean;
      amount = clean;
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
          notifyError(e, "Failed to create participant");
      } finally {
          isAddingParticipant = false;
      }
  }

  async function save() {
      if (!isValid) return;
      
      if (isOfflineEdit) {
          modals.alert({ 
              message: $t('common.offline_edit_error'),
              title: $t('common.offline')
          });
          return;
      }

      isLoading = true;
      try {
          const split = buildSplit(splitMode, splitValues, involved);
          const expenseData = {
              description,
              amount: amountValue,
              currency,
              exchange_rate: await exchangeRate(),
              payer,
              // Nobody is left out by a 0 share / amount / percent.
              involved: split.values ? involved.filter(id => (split.values![id] ?? 0) > 0) : involved,
              split,
              is_income: isIncome,
              date: new Date(date).toISOString(),
              icon,
              kimpay: kimpayId
          };

          if (initialData?.id) {
               await activeKimpay.updateExpense(initialData.id, expenseData, newPhotos, photosToDelete);
               toasts.success($t('toast.expense_updated'));
          } else {
               await activeKimpay.addExpense(expenseData, newPhotos);
               toasts.success($t('toast.expense_added'));
          }
          
          haptic('success');
          await goBack(`/k/${kimpayId}`);
      } catch (e) {
          console.error(e);
          haptic('error');
          toasts.error($t('error.generic'));
      } finally {
          isLoading = false;
      }
  }

  /**
   * Rate from the expense currency to the Kimpay's, frozen at the expense
   * date (0 when it cannot be fetched, e.g. offline: today's rate is then
   * used when computing balances). Kept as is when editing an expense whose
   * currency and date did not change.
   */
  async function exchangeRate(): Promise<number> {
      if (currency === defaultCurrency) return 0;
      if (
          initialData?.exchange_rate &&
          initialData.currency === currency &&
          initialData.date.slice(0, 10) === date
      ) {
          return initialData.exchange_rate;
      }
      // A slow rates API must not hold the save: today's rate is used instead.
      const timeout = new Promise<number>((resolve) => setTimeout(() => resolve(0), 6000));
      return Promise.race([getExchangeRateAt(currency, defaultCurrency, date), timeout]);
  }

  function handleScanComplete(result: import('./ReceiptScanner.svelte').ScanResult) {
      // Set description and amount
      description = result.description;
      amount = String(result.amount);
      
      // Update currency if valid
      if (CURRENCY_CODES.includes(result.currency)) {
          currency = result.currency;
      }
      
      // Set emoji if provided
      if (result.emoji) {
          icon = result.emoji;
      }
      
      // Set date if provided (format: YYYY-MM-DD)
      if (result.date) {
          date = result.date;
      }
      
      // Add the scanned photo to the expense
      if (result.photo) {
          newPhotos = [...newPhotos, result.photo];
      }

      // Same shop as a previous expense: suggest the same people (and split).
      const similar = findSimilarExpense(activeKimpay?.expenses ?? [], result.description);
      const known = new Set(participants.map(p => p.id));
      const suggested = similar?.involved?.filter(id => known.has(id)) ?? [];
      if (similar && suggested.length > 0) {
          involved = suggested;
          // Exact amounts belong to that other receipt: keep the proportions only.
          const mode = similar.split?.mode;
          if (mode === 'shares' || mode === 'percent') {
              splitMode = mode;
              splitValues = { ...similar.split!.values };
          } else {
              splitMode = 'equal';
              splitValues = {};
          }
      }
      
      modals.alert({
          title: $t('expense.form.scan_success'),
          message: `${result.description} - ${result.amount} ${result.currency}` +
              (similar && suggested.length > 0 ? `

${$t('expense.form.scan_suggested', { name: similar.description })}` : ''),
          variant: 'success'
      });
  }
</script>

<div class="flex flex-1 flex-col">
    <!-- Top bar: close, title, then the receipt scanner or delete -->
    <header class="sticky top-0 z-30 border-b bg-card/90 backdrop-blur-md">
        <div class="mx-auto flex h-14 max-w-lg items-center gap-2 px-4">
            <a
                href="/k/{kimpayId}"
                onclick={(e) => { e.preventDefault(); goBack(`/k/${kimpayId}`); }}
                class="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={$t('common.close')}
                title={$t('common.close')}
            >
                <X class="h-5 w-5" />
            </a>
            <h1 class="min-w-0 flex-1 truncate text-base font-bold">{title}</h1>
            {#if !initialData && !isIncome}
                <ReceiptScanner onScanComplete={handleScanComplete} disabled={isLoading} />
            {/if}
            {#if onDelete}
                <Button variant="ghost-destructive" size="icon" onclick={onDelete} aria-label={$t('common.delete')} title={$t('common.delete')}>
                    <Trash2 class="size-5!" />
                </Button>
            {/if}
        </div>
    </header>

    <div class="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 pt-5 pb-28">
        <!-- Expense or money received -->
        <SegmentedControl
            options={[
                { value: 'expense', label: $t('expense.type.expense') },
                { value: 'income', label: $t('expense.type.income') },
            ]}
            value={isIncome ? 'income' : 'expense'}
            label={$t('expense.type.label')}
            onchange={(v) => isIncome = v === 'income'}
        />

        <!-- Amount first, big -->
        <div class="space-y-2 text-center">
            <label for="amount" class="sr-only">{$t('expense.form.amount_label')}</label>
            <input
                id="amount"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                bind:value={amount}
                oninput={sanitizeAmount}
                placeholder={$t('expense.form.amount_placeholder')}
                class="w-full bg-transparent text-center text-5xl font-bold tracking-tight tabular-nums outline-hidden placeholder:text-muted-foreground/40"
            />
            <div class="flex justify-center">
                <CurrencySelect size="sm" position="bottom-left" bind:value={currency} />
            </div>
        </div>

        <div class="space-y-2">
            <Label for="description">{$t('expense.form.desc_label')}</Label>
            <div class="flex gap-2">
                <EmojiInput bind:value={icon} />
                <Input id="description" bind:value={description} placeholder={isIncome ? $t('expense.form.income_desc_placeholder') : $t('expense.form.desc_placeholder')} />
            </div>
        </div>

        <ParticipantSelector
            {participants}
            selected={payer ? [payer] : []}
            mode="single"
            label={isIncome ? $t('expense.form.received_by_label') : $t('expense.form.paid_by_label')}
            onSelectionChange={handlePayerChange}
            onAddNew={() => newParticipantSource = 'payer'}
        />

        <ParticipantSelector
            {participants}
            selected={involved}
            mode="multi"
            label={$t('expense.form.for_whom_label')}
            onSelectionChange={handleInvolvedChange}
            onAddNew={() => newParticipantSource = 'involved'}
            showToggleAll={true}
        />

        {#if involved.length > 0}
            <SplitEditor
                involved={involvedParticipants}
                bind:mode={splitMode}
                bind:values={splitValues}
                amount={amountValue}
                {currency}
            />
        {/if}

        <ListGroup>
            <DatePicker bind:value={date} label={$t('expense.form.date_label')} />
            <PhotoManager
                bind:existingPhotos
                record={initialData}
                onPhotosChange={handlePhotosChange}
            />
        </ListGroup>
    </div>

    <!-- The one save button, always in reach (fixed, like the tab bar) -->
    <div class="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        <div class="mx-auto max-w-lg px-4 py-3">
            <Button size="lg" class="w-full" onclick={save} disabled={!isValid || isLoading || isOfflineEdit}>
                {#if isLoading}
                    <LoaderCircle class="animate-spin" />
                {/if}
                {saveLabel}
            </Button>
        </div>
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
