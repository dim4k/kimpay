<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { onDestroy, onMount, untrack } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListRow from '#lib/components/ui/ListRow.svelte';
  import Switch from '#lib/components/ui/Switch.svelte';
  import EmojiInput from '#lib/components/ui/EmojiInput.svelte';
  import InputModal from '#lib/components/ui/modals/InputModal.svelte';
  import Modal from '#lib/components/ui/modals/Modal.svelte';
  import Calendar from '#lib/components/ui/Calendar.svelte';
  import IconTile from '#lib/components/ui/IconTile.svelte';
  import SummaryRow from '#lib/components/expense/SummaryRow.svelte';
  import PhotoManager from '#lib/components/PhotoManager.svelte';
  import ParticipantSelector from '#lib/components/ParticipantSelector.svelte';
  import ReceiptScanner from '#lib/components/ReceiptScanner.svelte';
  import SplitEditor from '#lib/components/expense/SplitEditor.svelte';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import Badge from '#lib/components/ui/Badge.svelte';
  import { t, locale } from '#lib/i18n.js';
  import { DEFAULT_EXPENSE_EMOJI, NAME_MAX_LENGTH } from '#lib/constants.js';

  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { Calendar as CalendarIcon, ChevronLeft, CircleAlert, CircleCheck, HandCoins, Sparkles, Split, Trash2, UserRound, X } from "@lucide/svelte";
  import { slide } from 'svelte/transition';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { CURRENCY_CODES, DEFAULT_CURRENCY, formatAmount, getExchangeRateAt } from '#lib/services/currency.js';
  import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { pendingReceipt } from '#lib/stores/pendingReceipt.js';
  import { haptic } from '#lib/utils/haptic.js';
  import { notifyError } from '#lib/utils/notify.js';
  import type { Expense, SplitMode } from '#lib/types.js';
  import { parseLocalISODate, toLocalISODate } from '#lib/utils/date.js';
  import { buildSplit, checkSplit, memberWeights, newExpenseDefaults } from '#lib/split.js';
  import { findSimilarExpense } from '#lib/utils/suggest.js';
  import { readReceipt, scanErrorKey, type OcrResult } from '#lib/services/ocr.js';
  import { sanitizeDecimal } from '#lib/utils/amount.js';
  import { loadKeywords } from '#lib/emoji/search.js';
  import { suggestEmoji } from '#lib/emoji/suggest.js';
  import { confirmDiscard, type ExpenseView } from '#lib/expenseSheet.js';

  let {
      kimpayId,
      initialData = null,
      template = null,
      title,
      onDelete,
      onClose,
      onSaved,
  }: {
      kimpayId: string;
      initialData?: Expense | null;
      /** A new expense filled in from this one (duplicate), dated today, without its photos */
      template?: Expense | null;
      /** Title of the sheet */
      title: string;
      /** Shows a delete button in the sheet's header (editing) */
      onDelete?: () => void;
      /** The close button: the sheet asks first when something was typed (see `hasChanges`) */
      onClose: () => void;
      /** Saved (except "save and add another"): the sheet closes */
      onSaved: () => void;
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
  // A couple counting as 2: their shares when split by shares.
  let weights = $derived(memberWeights(participants));
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

  let payerParticipant = $derived(participants.find(p => p.id === payer));
  let myId = $derived(activeKimpay?.myParticipantId ?? null);

  // The form is a summary (one line per setting); each setting is changed in
  // a panel of the sheet, with its own history entry: Back closes the panel.
  let view = $derived<ExpenseView>(page.state.expenseSheet?.view ?? 'main');

  function openView(next: ExpenseView) {
      const sheet = page.state.expenseSheet;
      if (!sheet) return;
      goto(window.location.href, { shallow: true, state: { expenseSheet: { ...sheet, view: next } } });
  }

  function closeView() {
      if (view !== 'main') history.back();
  }

  // A panel opens at its top (the summary may have been scrolled), with the
  // focus on its way back.
  function scrolledToTop(node: HTMLElement) {
      node.scrollIntoView({ block: 'start' });
  }

  function focused(node: HTMLElement) {
      node.focus();
  }

  let payerLabel = $derived(isIncome ? $t('expense.form.received_by_label') : $t('expense.form.paid_by_label'));
  let viewTitle = $derived(
      view === 'payer' ? payerLabel
      : view === 'involved' ? $t('expense.form.for_whom_label')
      : view === 'split' ? $t('expense.split.label')
      : view === 'date' ? $t('expense.form.date_label')
      : title
  );

  // The icon follows the description ("Resto" gives 🍽️) until picked by hand
  // or by a scan. `autoIcon` is the icon set that way, null once picked.
  let autoIcon = $state<string | null>(null);
  let iconKeywords = $state<Record<string, string>[]>([]);

  $effect(() => {
      const current = autoIcon;
      if (current === null) return;
      const next = suggestEmoji(description, iconKeywords) ?? DEFAULT_EXPENSE_EMOJI;
      untrack(() => {
          if (icon !== current) autoIcon = null;
          else if (next !== icon) icon = autoIcon = next;
      });
  });

  // What the form held when opened (or last saved): leaving with changes asks first.
  function formState(): string {
      return JSON.stringify([description, amount, icon, date, payer, involved, currency, isIncome, splitMode, splitValues, newPhotos.length, photosToDelete.length]);
  }
  let baseline = $state('');
  let isDirty = $derived(baseline !== '' && formState() !== baseline);

  /** Something typed since the form opened (or was last saved), not being saved: closing asks first. */
  export function hasChanges(): boolean {
      return isDirty && !isLoading;
  }
  // Saved or discarded: leave without asking.
  let leaving = false;

  onMount(() => {
      // Seed state from the expense edited, or the one duplicated
      const seed = initialData ?? template;
      if (seed) {
         description = seed.description || "";
         amount = seed.amount ? String(seed.amount) : "";
         icon = seed.icon || DEFAULT_EXPENSE_EMOJI;
         date = initialData?.date ? initialData.date.slice(0, 10) : toLocalISODate();
         payer = seed.payer || "";
         involved = seed.involved || [];
         currency = seed.currency || defaultCurrency;
         isIncome = !!seed.is_income;
         if (seed.split && seed.split.mode !== 'equal') {
             splitMode = seed.split.mode;
             splitValues = { ...seed.split.values };
         }

         if (initialData?.photos && Array.isArray(initialData.photos)) {
             existingPhotos = initialData.photos;
         }
      } else {
         // New expense: use Kimpay currency
         currency = defaultCurrency;
      }

      // A duplicate keeps the people still in the group.
      if (template) {
          const known = new Set(participants.map(p => p.id));
          involved = involved.filter(id => known.has(id));
          if (!known.has(payer)) payer = "";
      }

      // A new expense: the members still taking part, by their shares.
      if (!initialData && involved.length === 0) {
          const defaults = newExpenseDefaults(participants);
          involved = defaults.involved;
          if (defaults.split.values) {
              splitMode = defaults.split.mode;
              splitValues = { ...defaults.split.values };
          }
      }

      if (!initialData && !payer && activeKimpay?.myParticipantId) {
          payer = activeKimpay.myParticipantId;
      }

      if (icon === DEFAULT_EXPENSE_EMOJI) {
          autoIcon = icon;
          const lang = $locale;
          Promise.all([loadKeywords(lang), lang === 'en' ? Promise.resolve({}) : loadKeywords('en')])
              .then((k) => (iconKeywords = k));
      }

      baseline = formState();

      // A receipt picked from the expense list: read it right away.
      const receipt = initialData ? null : pendingReceipt.take();
      if (receipt) scan(receipt);
  });

  // Leaving the page under the sheet (a reload, a link): same question as
  // closing it. Shallow navigations stay on that page (a panel opened or
  // closed, the sheet closed by Back: the sheet asks then, see ExpenseSheet).
  beforeNavigate((nav) => {
      if (nav.shallow || leaving || !isDirty || isLoading) return;
      nav.cancel();
      // Closing or reloading the tab: the browser asks by itself.
      if (nav.willUnload) return;
      const to = nav.to?.url;
      confirmDiscard(() => {
          leaving = true;
          if (nav.type === 'popstate') history.go(nav.delta ?? -1);
          else if (to) goto(to);
      });
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

  // The summary of each setting, on its line.
  let involvedSummary = $derived.by(() => {
      if (involved.length === 0) return $t('expense.form.error_select_one');
      if (involved.length === participants.length && participants.length > 1) return $t('expense.form.everyone');
      return involvedParticipants.map(p => p.name).join(', ');
  });

  let splitSummary = $derived.by(() => {
      const { remaining } = splitCheck;
      switch (splitMode) {
          case 'equal':
              return perPerson ? `${$t('expense.split.equal_summary')} · ${perPerson}` : $t('expense.split.equal_summary');
          case 'shares':
              return splitCheck.valid ? $t('expense.split.shares_summary') : $t('expense.split.shares_invalid');
          case 'percent':
              if (remaining > 0) return $t('expense.split.percent_left', { percent: String(remaining) });
              if (remaining < 0) return $t('expense.split.percent_over', { percent: String(-remaining) });
              return $t('expense.split.percent_summary');
          case 'amounts':
              if (remaining > 0) return $t('expense.split.amount_left', { amount: formatAmount(remaining, currency, $locale) });
              if (remaining < 0) return $t('expense.split.amount_over', { amount: formatAmount(-remaining, currency, $locale) });
              return $t('expense.split.amounts_summary');
      }
  });

  let dateSummary = $derived(
      parseLocalISODate(date).toLocaleDateString($locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  );

  /** Digits and one decimal separator, at most 8 digits and 2 decimals. */
  function sanitizeAmount(e: Event) {
      const el = e.currentTarget as HTMLInputElement;
      const clean = sanitizeDecimal(el.value);
      if (clean !== el.value) el.value = clean;
      amount = clean;
      filled.amount = false;
  }

  // One payer: picking them closes the panel.
  function handlePayerChange(selected: string[]) {
      payer = selected[0] || "";
      closeView();
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
                 closeView();
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

  /** `andNew`: stay on an empty form, for the next one (same people, same day). */
  async function save(andNew = false) {
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
          if (andNew) {
              resetForNext();
          } else {
              leaving = true;
              onSaved();
          }
      } catch (e) {
          console.error(e);
          haptic('error');
          toasts.error($t('error.generic'));
      } finally {
          isLoading = false;
      }
  }

  let amountInput = $state<HTMLInputElement | null>(null);

  /** What changes from one expense to the next is cleared; who and when stay. */
  function resetForNext() {
      description = "";
      amount = "";
      icon = autoIcon = DEFAULT_EXPENSE_EMOJI;
      newPhotos = [];
      filled = { amount: false, description: false };
      scanApplied = null;
      scanError = "";
      // Exact amounts belonged to that expense; shares and percents still apply.
      if (splitMode === 'amounts') {
          splitMode = 'equal';
          splitValues = {};
      }
      baseline = formState();
      amountInput?.focus();
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
      autoIcon: string | null;
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

  // A new expense can be read from a receipt (not money received).
  let showScanButton = $derived(!initialData && !isIncome);

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
          autoIcon,
      };

      description = result.description;
      amount = String(result.amount);
      if (CURRENCY_CODES.includes(result.currency)) currency = result.currency;
      if (result.emoji) {
          icon = result.emoji;
          autoIcon = null;
      }
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
      autoIcon = s.autoIcon;
      filled = { amount: false, description: false };
      scanApplied = null;
  }
</script>

<!-- Only on the summary: a panel goes back with its chevron. -->
{#snippet saveFooter()}
    <!-- The one save button, always in reach -->
    <div class="space-y-1.5">
        <Button size="lg" class="w-full" onclick={() => save()} loading={isLoading} disabled={!isValid || isOfflineEdit}>
            {saveLabel}
        </Button>
        {#if missing && !isOfflineEdit}
            <p class="flex min-h-9 items-center justify-center text-center text-sm text-muted-foreground">
                {$t('expense.form.missing', { fields: missing })}
            </p>
        {:else if !initialData}
            <!-- Several in a row (after a trip): stays on the form. -->
            <button
                type="button"
                onclick={() => save(true)}
                disabled={isLoading}
                class="flex min-h-9 w-full items-center justify-center rounded-control text-sm font-semibold text-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
            >
                {$t('expense.form.save_and_new')}
            </button>
        {/if}
    </div>
{/snippet}

<Modal isOpen onClose={onClose} variant="sheet" label={title} footer={view === 'main' ? saveFooter : undefined}>
    {#snippet header()}
        <div class="flex items-center gap-1">
            {#if view !== 'main'}
                <button
                    type="button"
                    onclick={closeView}
                    {@attach focused}
                    class="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-primary transition-colors hover:bg-primary-soft"
                    aria-label={$t('common.back')}
                    title={$t('common.back')}
                >
                    <ChevronLeft class="h-5 w-5" />
                </button>
            {/if}
            <h2 class="min-w-0 flex-1 truncate text-xl font-bold">{viewTitle}</h2>
            {#if view === 'main'}
                {#if showScanButton}
                    <ReceiptScanner onPick={scan} busy={!!scanning} disabled={isLoading} />
                {/if}
                {#if onDelete}
                    <Button variant="ghost-destructive" size="icon" onclick={onDelete} aria-label={$t('common.delete')} title={$t('common.delete')}>
                        <Trash2 class="size-5!" />
                    </Button>
                {/if}
            {/if}
            <button
                type="button"
                onclick={onClose}
                class="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={$t('common.close')}
                title={$t('common.close')}
            >
                <X class="h-5 w-5" />
            </button>
        </div>
    {/snippet}

    <!-- The summary: kept (hidden) under a panel, so nothing typed is lost. -->
    <div class="space-y-5" hidden={view !== 'main'}>
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

        <!-- Amount first, big -->
        <div class="space-y-2 text-center">
            <label for="amount" class="sr-only">{$t('expense.form.amount_label')}</label>
            <input
                id="amount"
                bind:this={amountInput}
                type="text"
                inputmode="decimal"
                autocomplete="off"
                bind:value={amount}
                oninput={sanitizeAmount}
                placeholder={amountPlaceholder}
                class="w-full rounded-card bg-transparent text-center text-5xl font-bold tracking-tight tabular-nums outline-hidden transition-shadow placeholder:text-muted-foreground/40 {filled.amount ? 'ring-2 ring-primary/40' : ''} {isIncome ? 'text-success' : ''}"
            />
            <div class="flex items-center justify-center gap-2">
                <CurrencySelect size="sm" position="bottom-left" bind:value={currency} />
                {#if isIncome}
                    <Badge tone="success"><HandCoins class="h-3 w-3" />{$t('expense.type.income')}</Badge>
                {/if}
                {#if filled.amount}
                    <Badge><Sparkles class="h-3 w-3" />{$t('expense.form.scan_tag')}</Badge>
                {/if}
            </div>
        </div>

        <div class="flex gap-2">
            <label for="description" class="sr-only">{$t('expense.form.desc_label')}</label>
            <EmojiInput bind:value={icon} />
            <Input
                id="description"
                bind:value={description}
                oninput={() => filled.description = false}
                placeholder={isIncome ? $t('expense.form.income_desc_placeholder') : $t('expense.form.desc_placeholder')}
                class={filled.description ? 'border-primary ring-2 ring-primary/40' : ''}
            />
        </div>

        <!-- Who: each line opens its panel. -->
        <ListGroup>
            <SummaryRow label={payerLabel} invalid={!payerParticipant} onclick={() => openView('payer')}>
                {#snippet lead()}
                    {#if payerParticipant}
                        <Avatar name={payerParticipant.name} record={payerParticipant} class="h-8 w-8 shrink-0 text-[0.6875rem]" />
                    {:else}
                        <IconTile size="sm" tone="danger"><UserRound /></IconTile>
                    {/if}
                {/snippet}
                {#if payerParticipant}
                    <span class="truncate">{payerParticipant.name}</span>
                    {#if payerParticipant.id === myId}
                        <Badge>{$t('common.you')}</Badge>
                    {/if}
                {:else}
                    {$t('expense.form.choose')}
                {/if}
            </SummaryRow>
            <SummaryRow label={$t('expense.form.for_whom_label')} invalid={involved.length === 0} onclick={() => openView('involved')}>
                {#snippet lead()}
                    {#if involvedParticipants.length > 0}
                        <span class="flex shrink-0 -space-x-2.5">
                            {#each involvedParticipants.slice(0, 3) as p (p.id)}
                                <Avatar name={p.name} record={p} class="h-8 w-8 text-[0.6875rem] ring-2 ring-card" />
                            {/each}
                        </span>
                    {:else}
                        <IconTile size="sm" tone="danger"><UserRound /></IconTile>
                    {/if}
                {/snippet}
                <span class="truncate">{involvedSummary}</span>
            </SummaryRow>
            {#if involved.length > 0}
                <SummaryRow label={$t('expense.split.label')} icon={Split} invalid={!splitCheck.valid} onclick={() => openView('split')}>
                    <span class="truncate">{splitSummary}</span>
                </SummaryRow>
            {/if}
        </ListGroup>

        <ListGroup>
            <SummaryRow label={$t('expense.form.date_label')} icon={CalendarIcon} onclick={() => openView('date')}>
                <span class="truncate capitalize" data-testid="expense-date">{dateSummary}</span>
            </SummaryRow>
            <PhotoManager
                bind:newPhotos
                bind:existingPhotos
                bind:photosToDelete
                record={initialData}
            />
            <!-- Money received (a deposit back, a sale...): rare, so last. -->
            <ListRow icon={HandCoins} title={$t('expense.type.income')} subtitle={$t('expense.form.income_hint')}>
                {#snippet trailing()}
                    <Switch checked={isIncome} label={$t('expense.type.income')} onchange={(v) => isIncome = v} />
                {/snippet}
            </ListRow>
        </ListGroup>
    </div>

    <!-- The panel open: one setting, changed over the summary. -->
    {#if view !== 'main'}
        <div {@attach scrolledToTop}>
            {#if view === 'payer'}
                <ParticipantSelector
                    {participants}
                    selected={payer ? [payer] : []}
                    mode="single"
                    label={payerLabel}
                    hideLabel
                    onSelectionChange={handlePayerChange}
                    onAddNew={() => newParticipantSource = 'payer'}
                />
            {:else if view === 'involved'}
                <ParticipantSelector
                    {participants}
                    selected={involved}
                    mode="multi"
                    label={$t('expense.form.for_whom_label')}
                    onSelectionChange={handleInvolvedChange}
                    onAddNew={() => newParticipantSource = 'involved'}
                    showToggleAll={true}
                />
            {:else if view === 'split'}
                <SplitEditor
                    involved={involvedParticipants}
                    bind:mode={splitMode}
                    bind:values={splitValues}
                    amount={amountValue}
                    {currency}
                    {weights}
                />
            {:else if view === 'date'}
                <Calendar bind:value={date} label={$t('expense.form.date_label')} onselect={closeView} />
            {/if}
        </div>
    {/if}

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
</Modal>
