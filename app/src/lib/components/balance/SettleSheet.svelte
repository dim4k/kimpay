<script lang="ts">
    import { untrack } from "svelte";
    import { Calendar as CalendarIcon, Check } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import type { Transaction } from '#lib/balance.js';
    import { convert, formatAmount, getSymbol } from '#lib/services/currency.js';
    import { fromMinor, toMinor } from '#lib/split.js';
    import { formatDecimal, parseDecimal } from '#lib/utils/amount.js';
    import { dayLabel, toLocalISODate } from '#lib/utils/date.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import AmountInput from '#lib/components/ui/AmountInput.svelte';
    import Calendar from '#lib/components/ui/Calendar.svelte';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import SummaryRow from '#lib/components/expense/SummaryRow.svelte';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';

    interface Props {
        /** The suggested payment to record (null: closed) */
        tx: Transaction | null;
        /** "You" or the names of the two people */
        from: string;
        to: string;
        /** The currency the balance page shows, to tell the amount in it too */
        displayCurrency: string;
        exchangeRates: Record<string, number>;
        onClose: () => void;
        /** What was paid (in the transaction's currency), and when; throws when not recorded */
        onConfirm: (amount: number, date: string) => Promise<void>;
    }

    let { tx, from, to, displayCurrency, exchangeRates, onClose, onConfirm }: Props = $props();

    // All of it by default, to the cent: paying part of it is a change of the
    // amount. Reset for each payment opened.
    let currency = $derived(tx?.currency ?? '');
    const toCent = (n: number) => fromMinor(toMinor(n, currency), currency);
    let due = $derived(tx ? toCent(tx.amount) : 0);
    let amount = $state('');
    let date = $state(toLocalISODate());
    let opened = $derived(tx ? `${tx.from}>${tx.to}>${due}` : null);
    $effect(() => {
        if (!opened) return;
        untrack(() => {
            amount = formatDecimal(due, $locale);
            date = toLocalISODate();
            pickingDate = false;
        });
    });

    let value = $derived(toCent(parseDecimal(amount)));
    let tooMuch = $derived(value > due);
    let remaining = $derived(value > 0 && !tooMuch ? toCent(due - value) : 0);
    let today = $derived(toLocalISODate());
    // The day, as in the expense form: a row, the calendar when tapped.
    let pickingDate = $state(false);
    let dateSummary = $derived(dayLabel(date, $locale, { today: $t('datepicker.today'), yesterday: $t('date.yesterday') }));
    let isSaving = $state(false);

    async function confirm() {
        if (!tx || value <= 0 || tooMuch || isSaving) return;
        isSaving = true;
        try {
            // Today: now, to keep the order of the day. Another day: that day.
            await onConfirm(value, date === today || !date ? new Date().toISOString() : new Date(date).toISOString());
            onClose();
        } catch {
            // Not recorded: the caller said why, the sheet stays open.
        } finally {
            isSaving = false;
        }
    }
</script>

{#snippet footer()}
    <Button size="lg" class="w-full" onclick={confirm} loading={isSaving} disabled={value <= 0 || tooMuch}>
        <Check class="size-5!" />
        {$t('balance.settle.confirm')}
    </Button>
{/snippet}

<Modal isOpen={!!tx} onClose={isSaving ? undefined : onClose} variant="sheet" label={$t('balance.settle.modal.title')} footer={tx ? footer : undefined}>
    {#snippet header()}
        <ModalHeader
            title={$t('balance.settle.modal.title')}
            description={$t('balance.settle.sheet.desc', { from, to })}
            align="start"
            onClose={isSaving ? undefined : onClose}
        />
    {/snippet}
    {#if tx}

        <!-- The same amount as an expense's: what was paid, all of it by default. -->
        <div class="space-y-2">
            <AmountInput
                id="settle-amount"
                label={$t('balance.settle.amount_label')}
                bind:value={amount}
                invalid={tooMuch}
                describedby="settle-amount-hint"
                onenter={confirm}
            >
                {#snippet below()}
                    <span class="flex h-8 items-center gap-1.5 rounded-control bg-muted px-2.5 text-xs font-medium">
                        <span>{getSymbol(tx!.currency)}</span>
                        <span>{tx!.currency}</span>
                    </span>
                {/snippet}
            </AmountInput>
            <p id="settle-amount-hint" class="text-center text-sm {tooMuch ? 'text-destructive' : 'text-muted-foreground'}" aria-live="polite">
                {#if tooMuch}
                    {$t('balance.settle.too_much', { amount: formatAmount(due, tx.currency, $locale) })}
                {:else if remaining > 0}
                    {$t('balance.settle.remaining', { amount: formatAmount(remaining, tx.currency, $locale) })}
                {:else if displayCurrency && displayCurrency !== tx.currency && value > 0}
                    ≈ {formatAmount(convert(value, tx.currency, displayCurrency, exchangeRates), displayCurrency, $locale)}
                {:else}
                    {$t('balance.settle.partial_hint')}
                {/if}
            </p>
        </div>

        {#if pickingDate}
            <Calendar bind:value={date} max={today} label={$t('expense.form.date_label')} onselect={() => (pickingDate = false)} />
        {:else}
            <ListGroup>
                <SummaryRow label={$t('expense.form.date_label')} icon={CalendarIcon} onclick={() => (pickingDate = true)}>
                    <span class="truncate first-letter:uppercase">{dateSummary}</span>
                </SummaryRow>
            </ListGroup>
        {/if}

    {/if}
</Modal>
