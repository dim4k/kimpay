<script lang="ts">
    import { Camera, HandCoins, Repeat } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { repeatFrequency } from '#lib/repeat.js';
    import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { formatAmount, DEFAULT_CURRENCY } from '#lib/services/currency.js';
    import { expenseImpact, isSettled, toKimpayAmount } from '#lib/balance.js';
    import SwipeableItem from '#lib/components/ui/SwipeableItem.svelte';
    import Badge from '#lib/components/ui/Badge.svelte';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import type { Expense } from '#lib/types.js';

    let {
        expense,
        currentUserId,
        participantIds,
        onOpen,
        onRequestDelete,
        view = 'total',
        kimpayCurrency,
        exchangeRates,
        isNew = false,
        readonly = false,
    }: {
        expense: Expense;
        currentUserId: string | null;
        /** All participants of the group (to compute each share) */
        participantIds: string[];
        /** Amounts in another currency also show their value in this one. */
        kimpayCurrency: string;
        exchangeRates: Record<string, number>;
        /** Added by someone else since my last visit. */
        isNew?: boolean;
        /** Read-only link: no swipe */
        readonly?: boolean;
        /** The line touched: its sheet (the form, or the details) */
        onOpen: (expense: Expense) => void;
        onRequestDelete?: (expenseId: string) => void;
        /**
         * `total`: who paid and the amount. `me`: what the expense changes
         * for me on the right ("you owe €12.50").
         */
        view?: 'total' | 'me';
    } = $props();

    let hasPhotos = $derived(!!expense.photos && expense.photos.length > 0);
    // Copied by the server this often (the latest of its series).
    let repeats = $derived(!!expense.repeat_day && !expense.is_reimbursement);
    let frequencyLabel = $derived($t(`expense.repeat.${repeatFrequency(expense.repeat_every)}`));
    let currency = $derived(expense.currency || DEFAULT_CURRENCY);

    // In another currency: "≈ €44.10" under the amount.
    let rate = $derived(
        currency !== kimpayCurrency && expense.amount > 0 ? toKimpayAmount(expense, kimpayCurrency, exchangeRates) / expense.amount : null
    );
    function approx(value: number): string | null {
        return rate ? `≈ ${formatAmount(value * rate, kimpayCurrency, $locale)}` : null;
    }

    function nameOf(id: string | undefined, name: string | undefined): string {
        if (currentUserId && id === currentUserId) return $t('common.you');
        return name || $t('common.unknown');
    }

    /** Same, inside a sentence ("Paid by you"). */
    function inSentence(id: string | undefined, name: string | undefined): string {
        return currentUserId && id === currentUserId ? $t('common.you_in_sentence') : nameOf(id, name);
    }

    let paidByMe = $derived(!!currentUserId && expense.payer === currentUserId);

    // What this expense changes to my balance (see expenseImpact). Shown in
    // the "for me" view, which needs an identity in the group; reimbursements
    // keep their usual line (it already says who paid whom).
    let impact = $derived(currentUserId ? expenseImpact(expense, currentUserId, participantIds) : null);
    let showImpact = $derived(view === 'me' && impact !== null);

    // A reimbursement, in the "for me" view: what I got back or paid back,
    // in a neutral color (getting money back means I am owed less, not more).
    let myReimbursement = $derived.by((): 'got_back' | 'paid_back' | 'none' | null => {
        if (view !== 'me' || !expense.is_reimbursement || !currentUserId) return null;
        if (expense.payer === currentUserId) return 'paid_back';
        if (expense.involved?.[0] === currentUserId) return 'got_back';
        return 'none';
    });

    // "Laetitia paid €25.00", "You received €40.00"...
    let paidAmount = $derived.by(() => {
        const amount = formatAmount(expense.amount, currency, $locale);
        if (expense.is_income) {
            return paidByMe ? $t('expense.list.you_received', { amount }) : $t('expense.list.name_received', { name: nameOf(expense.payer, expense.expand?.payer?.name), amount });
        }
        return paidByMe ? $t('expense.list.you_paid', { amount }) : $t('expense.list.name_paid', { name: nameOf(expense.payer, expense.expand?.payer?.name), amount });
    });

    // "Paid by Laetitia", or "Paid by you" in bold: what I paid stands out.
    let payerLabel = $derived.by(() => {
        if (expense.is_reimbursement) {
            const to = expense.expand?.involved?.[0];
            return $t('expense.list.reimbursement', {
                from: inSentence(expense.payer, expense.expand?.payer?.name),
                to: inSentence(to?.id, to?.name),
            });
        }
        const paidBy = expense.is_income ? $t('expense.list.received_by') : $t('expense.list.paid_by');
        return `${paidBy} ${inSentence(expense.payer, expense.expand?.payer?.name)}`;
    });
    let people = $derived($t('expense.list.people', { count: String(expense.involved?.length || 0) }));
    // In a pill when I am one of them: "for you" when I am the only one.
    let involvesMe = $derived(!!currentUserId && (expense.involved ?? []).includes(currentUserId));
    let peopleLabel = $derived(involvesMe && expense.involved?.length === 1 ? $t('expense.list.only_you') : people);

    // Swiped to the left: deleted. Not a reimbursement (cancelled from its
    // sheet), not offline, not on the read-only link.
    let swipeDisabled = $derived(readonly || !onRequestDelete || expense.is_reimbursement || offlineStore.isOffline);
</script>

{#snippet approxLine(value: number)}
    {@const text = approx(value)}
    {#if text}
        <span class="block whitespace-nowrap text-xs tabular-nums text-muted-foreground">{text}</span>
    {/if}
{/snippet}

<SwipeableItem disabled={swipeDisabled} onAction={() => onRequestDelete?.(expense.id)}>
<div class="expense-item" data-expense={expense.id}>
    <button
        type="button"
        aria-haspopup="dialog"
        onclick={() => onOpen(expense)}
        class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 focus-ring-inset"
    >
        <IconTile tone="muted" class="relative {expense.is_reimbursement ? '' : 'text-foreground'}">
            {#if expense.is_reimbursement}
                <HandCoins />
            {:else}
                {expense.icon || DEFAULT_EXPENSE_EMOJI}
            {/if}
            {#if hasPhotos}
                <span class="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
                    <Camera class="size-2.5!" />
                </span>
            {/if}
        </IconTile>

        <span class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-1.5 text-base font-medium">
                <span class="truncate">{expense.is_reimbursement ? $t('balance.reimbursement') : expense.description}</span>
                {#if repeats}
                    <Repeat class="h-3.5 w-3.5 shrink-0 text-muted-foreground" role="img" aria-label={frequencyLabel} />
                {/if}
            </span>
            <span class="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                {#if expense.is_reimbursement}
                    <span class="truncate">{payerLabel}</span>
                {:else if showImpact}
                    <span class="truncate {paidByMe ? 'font-semibold text-foreground' : ''}">{paidAmount}</span>
                {:else}
                    <span class="truncate {paidByMe ? 'font-semibold text-foreground' : ''}">{payerLabel}</span>
                    <span aria-hidden="true">·</span>
                    {#if involvesMe}
                        <Badge tone="primary">{peopleLabel}</Badge>
                    {:else}
                        <span class="shrink-0">{people}</span>
                    {/if}
                {/if}
            </span>
        </span>

        {#if isNew}
            <span class="h-2 w-2 shrink-0 rounded-full bg-primary" role="img" aria-label={$t('expense.list.new')}></span>
        {/if}
        <span class="shrink-0 text-right">
            {#if myReimbursement === 'none'}
                <span class="block whitespace-nowrap text-xs text-muted-foreground">{$t('expense.list.not_involved')}</span>
            {:else if myReimbursement}
                <span class="block whitespace-nowrap text-xs text-muted-foreground">
                    {myReimbursement === 'got_back' ? $t('expense.list.you_got_back') : $t('expense.list.you_paid_back')}
                </span>
                <span class="block whitespace-nowrap text-base font-semibold tabular-nums">{formatAmount(expense.amount, currency, $locale)}</span>
                {@render approxLine(expense.amount)}
            {:else if showImpact}
                <!-- Two words over my amount: what the expense means for me. -->
                {#if impact === undefined}
                    <span class="block whitespace-nowrap text-xs text-muted-foreground">{$t('expense.list.not_involved')}</span>
                {:else if isSettled(impact ?? 0)}
                    <span class="block whitespace-nowrap text-xs text-muted-foreground">{$t('members.settled')}</span>
                {:else}
                    <span class="block whitespace-nowrap text-xs text-muted-foreground">{impact! > 0 ? $t('expense.list.owed_to_you') : $t('expense.list.you_owe')}</span>
                    <span class="block whitespace-nowrap text-base font-semibold tabular-nums {impact! > 0 ? 'text-success' : 'text-warning'}">
                        {formatAmount(Math.abs(impact!), currency, $locale)}
                    </span>
                    {@render approxLine(Math.abs(impact!))}
                {/if}
            {:else}
                <span class="block whitespace-nowrap text-base font-semibold tabular-nums">
                    {expense.is_income ? '+' : ''}{formatAmount(expense.amount, currency, $locale)}
                </span>
                {@render approxLine(expense.amount)}
            {/if}
        </span>
    </button>
</div>
</SwipeableItem>
