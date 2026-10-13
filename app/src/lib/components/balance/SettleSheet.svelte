<script lang="ts">
    import { untrack } from "svelte";
    import { Check } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import type { Transaction } from '#lib/balance.js';
    import { convert, formatAmount } from '#lib/services/currency.js';
    import { fromMinor, toMinor } from '#lib/split.js';
    import { formatDecimal, parseDecimal, sanitizeDecimal } from '#lib/utils/amount.js';
    import { toLocalISODate } from '#lib/utils/date.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';
    import ModalActions from '#lib/components/ui/modals/ModalActions.svelte';

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
        });
    });

    let value = $derived(toCent(parseDecimal(amount)));
    let tooMuch = $derived(value > due);
    let remaining = $derived(value > 0 && !tooMuch ? toCent(due - value) : 0);
    let today = $derived(toLocalISODate());
    let isSaving = $state(false);

    function sanitize(e: Event) {
        const el = e.currentTarget as HTMLInputElement;
        const clean = sanitizeDecimal(el.value);
        if (clean !== el.value) el.value = clean;
        amount = clean;
    }

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

<Modal isOpen={!!tx} onClose={isSaving ? undefined : onClose} variant="sheet" label={$t('balance.settle.modal.title')}>
    {#if tx}
        <ModalHeader
            title={$t('balance.settle.modal.title')}
            description={$t('balance.settle.sheet.desc', { from, to })}
            align="start"
            onClose={isSaving ? undefined : onClose}
        />

        <div class="space-y-2">
            <Label for="settle-amount">{$t('balance.settle.amount_label')}</Label>
            <div class="flex items-center gap-2">
                <Input
                    id="settle-amount"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    value={amount}
                    oninput={sanitize}
                    onkeydown={(e) => e.key === 'Enter' && confirm()}
                    aria-invalid={tooMuch}
                    class="text-lg font-semibold tabular-nums"
                />
                <span class="shrink-0 text-sm font-semibold text-muted-foreground">{tx.currency}</span>
            </div>
            <p class="text-sm {tooMuch ? 'text-destructive' : 'text-muted-foreground'}" aria-live="polite">
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

        <div class="space-y-2">
            <Label for="settle-date">{$t('expense.form.date_label')}</Label>
            <Input id="settle-date" type="date" bind:value={date} max={today} />
        </div>

        <ModalActions>
            <Button variant="secondary" onclick={onClose} disabled={isSaving}>
                {$t('common.cancel')}
            </Button>
            <Button onclick={confirm} loading={isSaving} disabled={value <= 0 || tooMuch}>
                <Check />
                {$t('balance.settle.confirm')}
            </Button>
        </ModalActions>
    {/if}
</Modal>
