<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import { onDestroy, onMount } from 'svelte';
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
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import Badge from '#lib/components/ui/Badge.svelte';
  import { t, locale } from '#lib/i18n.js';
  import { DEFAULT_EXPENSE_EMOJI, NAME_MAX_LENGTH } from '#lib/constants.js';

  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { CircleAlert, CircleCheck, Sparkles, Trash2, X } from "@lucide/svelte";
  import { slide } from 'svelte/transition';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { CURRENCY_CODES, DEFAULT_CURRENCY, formatAmount, getExchangeRateAt } from '#lib/services/currency.js';
  import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { pendingReceipt } from '#lib/stores/pendingReceipt.js';
  import { haptic } from '#lib/utils/haptic.js';
  import { notifyError } from '#lib/utils/notify.js';
  import type { Expense, SplitMode } from '#lib/types.js';
  import { toLocalISODate } from '#lib/utils/date.js';
  import { buildSplit, checkSplit } from '#lib/split.js';
  import { findSimilarExpense } from '#lib/utils/suggest.js';
  import { readReceipt, scanErrorKey, type OcrResult } from '#lib/services/ocr.js';

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

  // The payer is me most of the time: one line, unfolded on demand.
  let isPayerOpen = $state(false);
  let payerParticipant = $derived(participants.find(p => p.id === payer));
  let myId = $derived(activeKimpay?.myParticipantId ?? null);

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

      // A receipt picked from the expense list: read it right away.
      const receipt = initialData ? null : pendingReceipt.take();
      if (receipt) scan(receipt);
  });

  let isValid = $derived(!!description && amountValue > 0 && !!payer && involved.length > 0 && splitCheck.valid);
  // Expenses cannot be edited offline (only created).
  let isOfflineEdit = $derived(!!initialData?.id && offlineStore.isOffline);

  let saveLabel = $derived.by(() => {
      if (isOfflineEdit) return $t('common.offline');
      const action = initialData ? $t('expense.form.update_button') : $t('expense.form.save_button');
      return amountValue > 0 ? `${action} · ${formatAmount(amountValue, currency, $locale)}` : action;
  });

  // Why the save button is disabled, when a field is simply empty (the
  // participants and the split explain their own errors).
  let missing = $derived(
      [
          amountValue > 0 ? null : $t('expense.form.missing_amount'),
          description.trim() ? null : $t('expense.form.missing_description'),
      ].filter(Boolean).join(', ')
  );

  // "0.00" or "0,00": the decimal separator of the language.
  let amountPlaceholder = $derived((0).toLocaleString($locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  // What each one pays, when everybody pays the same.
  let perPerson = $derived(
      splitMode === 'equal' && amountValue > 0 && involved.length > 1
          ? $t('expense.form.per_person', { amount: formatAmount(amountValue / involved.length, currency, $locale) })
          : ''
  );

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
      filled.amount = false;
  }

  function handlePayerChange(selected: string[]) {
      payer = selected[0] || "";
      isPayerOpen = false;
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
                 isPayerOpen = false;
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
      if (!isValid || isOfflineEdit) return;

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

  // ---------------------------------------------------------------------------
  // Receipt scanner
  // ---------------------------------------------------------------------------

  /** The form as it was before a scan filled it, to undo the scan. */
  interface Snapshot {
      description: string;
      amount: string;
      icon: string;
      date: string;
      currency: string;
      involved: string[];
      splitMode: SplitMode;
      splitValues: Record<string, number>;
      newPhotos: File[];
  }

  /** The photo being read (shown full screen until the result comes back). */
  let scanning = $state<{ file: File; url: string } | null>(null);
  let scanError = $state("");
  /** Set once a scan filled the form: what to tell, and how to undo it. */
  let scanApplied = $state<{ suggestedFrom: string | null; snapshot: Snapshot } | null>(null);
  /** Fields filled by the scan, highlighted until edited. */
  let filled = $state({ amount: false, description: false });
  // Bumped to ignore the result of a cancelled scan.
  let scanRun = 0;

  // An empty new expense invites to scan; once typing started, the top bar does.
  let showScanCard = $derived(!initialData && !isIncome && !scanApplied && !amount && !description);
  let showScanButton = $derived(!initialData && !isIncome && !showScanCard);

  async function scan(file: File) {
      const run = ++scanRun;
      scanError = "";
      scanning = { file, url: URL.createObjectURL(file) };
      try {
          const result = await readReceipt(file, $locale);
          if (run !== scanRun) return;
          applyScan(result, file);
          haptic('success');
      } catch (error) {
          if (run !== scanRun) return;
          console.error('OCR Error:', error);
          haptic('error');
          scanError = $t(scanErrorKey(error));
      } finally {
          if (run === scanRun) stopScanning();
      }
  }

  function cancelScan() {
      scanRun++;
      stopScanning();
  }

  function stopScanning() {
      if (scanning) URL.revokeObjectURL(scanning.url);
      scanning = null;
  }

  onDestroy(() => {
      if (scanning) URL.revokeObjectURL(scanning.url);
  });

  function applyScan(result: OcrResult, photo: File) {
      const snapshot: Snapshot = {
          description, amount, icon, date, currency,
          involved: [...involved],
          splitMode,
          splitValues: { ...splitValues },
          newPhotos: [...newPhotos],
      };

      description = result.description;
      amount = String(result.amount);
      if (CURRENCY_CODES.includes(result.currency)) currency = result.currency;
      if (result.emoji) icon = result.emoji;
      // YYYY-MM-DD
      if (result.date) date = result.date;
      // The receipt is kept with the expense.
      newPhotos = [...newPhotos, photo];

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

      filled = { amount: true, description: true };
      scanApplied = { suggestedFrom: similar && suggested.length > 0 ? similar.description : null, snapshot };
  }

  function undoScan() {
      if (!scanApplied) return;
      const s = scanApplied.snapshot;
      description = s.description;
      amount = s.amount;
      icon = s.icon;
      date = s.date;
      currency = s.currency;
      involved = s.involved;
      splitMode = s.splitMode;
      splitValues = s.splitValues;
      newPhotos = s.newPhotos;
      filled = { amount: false, description: false };
      scanApplied = null;
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
            {#if showScanButton}
                <ReceiptScanner onPick={scan} busy={!!scanning} disabled={isLoading} />
            {/if}
            {#if onDelete}
                <Button variant="ghost-destructive" size="icon" onclick={onDelete} aria-label={$t('common.delete')} title={$t('common.delete')}>
                    <Trash2 class="size-5!" />
                </Button>
            {/if}
        </div>
    </header>

    <div class="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 pt-5 pb-28">
        {#if scanError}
            <div class="flex items-start gap-3 rounded-control bg-destructive/10 p-3 text-destructive" role="alert" transition:slide={{ duration: 150 }}>
                <CircleAlert class="mt-0.5 h-5 w-5 shrink-0" />
                <div class="min-w-0 flex-1 text-sm">
                    <p class="font-semibold">{$t('expense.form.scan_error')}</p>
                    <p class="text-foreground/80">{scanError}</p>
                </div>
                <button type="button" onclick={() => scanError = ""} class="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-control hover:bg-destructive/10" aria-label={$t('common.close')}>
                    <X class="h-4 w-4" />
                </button>
            </div>
        {/if}

        {#if scanApplied}
            <div class="flex items-center gap-3 rounded-control bg-success-soft p-3 text-success" role="status" transition:slide={{ duration: 150 }}>
                <CircleCheck class="h-5 w-5 shrink-0" />
                <div class="min-w-0 flex-1 text-sm">
                    <p class="font-semibold">{$t('expense.form.scan_filled')}</p>
                    <p class="text-foreground/80">
                        {scanApplied.suggestedFrom
                            ? $t('expense.form.scan_suggested', { name: scanApplied.suggestedFrom })
                            : $t('expense.form.scan_check')}
                    </p>
                </div>
                <Button variant="ghost" size="sm" class="shrink-0 text-success hover:bg-success/10" onclick={undoScan}>
                    {$t('common.undo')}
                </Button>
            </div>
        {/if}

        {#if showScanCard}
            <div class="space-y-4" transition:slide={{ duration: 150 }}>
                <ReceiptScanner variant="card" onPick={scan} busy={!!scanning} disabled={isLoading} />
                <div class="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
                    <span class="h-px flex-1 bg-border"></span>
                    {$t('expense.form.or_manual')}
                    <span class="h-px flex-1 bg-border"></span>
                </div>
            </div>
        {/if}

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
                placeholder={amountPlaceholder}
                class="w-full rounded-card bg-transparent text-center text-5xl font-bold tracking-tight tabular-nums outline-hidden transition-shadow placeholder:text-muted-foreground/40 {filled.amount ? 'ring-2 ring-primary/40' : ''}"
            />
            <div class="flex items-center justify-center gap-2">
                <CurrencySelect size="sm" position="bottom-left" bind:value={currency} />
                {#if filled.amount}
                    <Badge><Sparkles class="h-3 w-3" />{$t('expense.form.scan_tag')}</Badge>
                {/if}
            </div>
        </div>

        <div class="space-y-2">
            <Label for="description">{$t('expense.form.desc_label')}</Label>
            <div class="flex gap-2">
                <EmojiInput bind:value={icon} />
                <Input
                    id="description"
                    bind:value={description}
                    oninput={() => filled.description = false}
                    placeholder={isIncome ? $t('expense.form.income_desc_placeholder') : $t('expense.form.desc_placeholder')}
                    class={filled.description ? 'border-primary ring-2 ring-primary/40' : ''}
                />
            </div>
        </div>

        {#if isPayerOpen || !payerParticipant}
            <ParticipantSelector
                {participants}
                selected={payer ? [payer] : []}
                mode="single"
                label={isIncome ? $t('expense.form.received_by_label') : $t('expense.form.paid_by_label')}
                onSelectionChange={handlePayerChange}
                onAddNew={() => newParticipantSource = 'payer'}
            />
        {:else}
            <div class="space-y-2">
                <Label tag="span" id="payer-label">{isIncome ? $t('expense.form.received_by_label') : $t('expense.form.paid_by_label')}</Label>
                <button
                    type="button"
                    onclick={() => isPayerOpen = true}
                    aria-describedby="payer-label"
                    class="flex w-full min-h-14 items-center gap-3 rounded-card border bg-card px-4 py-2 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Avatar name={payerParticipant.name} record={payerParticipant} class="h-9 w-9 text-xs" />
                    <span class="flex min-w-0 flex-1 items-center gap-2">
                        <span class="truncate text-base font-medium">{payerParticipant.name}</span>
                        {#if payerParticipant.id === myId}
                            <Badge>{$t('common.you')}</Badge>
                        {/if}
                    </span>
                    <span class="shrink-0 text-sm font-semibold text-primary">{$t('expense.form.change')}</span>
                </button>
            </div>
        {/if}

        <ParticipantSelector
            {participants}
            selected={involved}
            mode="multi"
            label={$t('expense.form.for_whom_label')}
            hint={perPerson}
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
                bind:newPhotos
                bind:existingPhotos
                bind:photosToDelete
                record={initialData}
            />
        </ListGroup>
    </div>

    <!-- The one save button, always in reach (fixed, like the tab bar) -->
    <div class="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        <div class="mx-auto max-w-lg space-y-1.5 px-4 py-3">
            <Button size="lg" class="w-full" onclick={save} loading={isLoading} disabled={!isValid || isOfflineEdit}>
                {saveLabel}
            </Button>
            {#if missing && !isOfflineEdit}
                <p class="text-center text-sm text-muted-foreground">
                    {$t('expense.form.missing', { fields: missing })}
                </p>
            {/if}
        </div>
    </div>

    <!-- Add Participant Modal -->
    <InputModal
        isOpen={!!newParticipantSource}
        title={$t('modal.add_participant.title')}
        placeholder={$t('modal.add_participant.placeholder')}
        confirmText={$t('modal.add_participant.confirm')}
        cancelText={$t('common.cancel')}
        maxlength={NAME_MAX_LENGTH}
        isProcessing={isAddingParticipant}
        onConfirm={handleNewParticipant}
        onCancel={() => newParticipantSource = null}
    />
</div>

<!-- Reading a receipt: the photo, full screen, until the result comes back. -->
{#if scanning}
    <div class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 p-6 backdrop-blur-sm" role="status" aria-live="polite">
        <div class="relative max-h-[50dvh] max-w-xs overflow-hidden rounded-card border shadow-xl">
            <img src={scanning.url} alt="" class="max-h-[50dvh] w-full object-contain" />
            <span class="animate-scan-line absolute inset-x-0 h-0.5 bg-primary shadow-[0_0_12px_2px] shadow-primary/60" aria-hidden="true"></span>
        </div>
        <div class="space-y-1 text-center">
            <p class="text-lg font-bold">{$t('expense.form.scanning')}</p>
            <p class="text-sm text-muted-foreground">{$t('expense.form.scanning_desc')}</p>
        </div>
        <Button variant="secondary" onclick={cancelScan}>{$t('common.cancel')}</Button>
    </div>
{/if}
