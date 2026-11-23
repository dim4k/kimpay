<script lang="ts">
    import { ArrowDownLeft, Camera, Copy, Repeat, Trash2 } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { repeatFrequency } from '#lib/repeat.js';
    import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { formatAmount, DEFAULT_CURRENCY } from '#lib/services/currency.js';
    import { toKimpayAmount } from '#lib/balance.js';
    import SwipeableItem from '#lib/components/ui/SwipeableItem.svelte';
    import Badge from '#lib/components/ui/Badge.svelte';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import type { Expense } from '#lib/types.js';

    let {
        expense,
        currentUserId,
        participantIds,
        onOpen,
        onRequestDelete,
        onDuplicate,
        kimpayCurrency,
        exchangeRates,
        isNew = false,
        readonly = false,
        selected = false,
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
        /** Open in the panel beside the list (computers) */
        selected?: boolean;
        /** The line touched: its sheet (the form, or the details) */
        onOpen: (expense: Expense) => void;
        onRequestDelete?: (expenseId: string) => void;
        /** Computers: a copy, from the line's hover actions */
        onDuplicate?: (expense: Expense) => void;
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

    // "Paid by Laetitia", or "Paid by you" in bold: what I paid stands out.
    let payerLabel = $derived.by(() => {
        const paidBy = expense.is_income ? $t('expense.list.received_by') : $t('expense.list.paid_by');
        return `${paidBy} ${inSentence(expense.payer, expense.expand?.payer?.name)}`;
    });

    // A reimbursement is titled by who paid whom ("Léa → you").
    let reimbursementTitle = $derived.by(() => {
        const to = expense.expand?.involved?.[0];
        return `${nameOf(expense.payer, expense.expand?.payer?.name)} → ${inSentence(to?.id, to?.name)}`;
    });

    // Money in and reimbursements say what they are (an expense needs not).
    let typeLabel = $derived(
        expense.is_reimbursement ? $t('expense.type.reimbursement') : expense.is_income ? $t('expense.type.income_short') : null
    );
    let people = $derived($t('expense.list.people', { count: String(expense.involved?.length || 0) }));
    // In a pill when I am one of them: "for you" when I am the only one.
    let involvesMe = $derived(!!currentUserId && (expense.involved ?? []).includes(currentUserId));
    let peopleLabel = $derived(involvesMe && expense.involved?.length === 1 ? $t('expense.list.only_you') : people);

    // The columns of a wide list (computers): who paid, and for whom.
    let payer = $derived(expense.expand?.payer);
    let beneficiaries = $derived(expense.expand?.involved ?? []);
    // A reimbursement's: who got the money.
    let receiver = $derived(beneficiaries[0]);
    let forLabel = $derived.by(() => {
        if (expense.is_reimbursement || beneficiaries.length === 1) {
            const one = beneficiaries[0];
            return nameOf(one?.id, one?.name);
        }
        if (participantIds.length > 1 && (expense.involved?.length ?? 0) === participantIds.length) return $t('expense.form.everyone');
        return people;
    });

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

<!-- A reimbursement: a card of its own, outlined in dashes and not filled,
     so it is not taken for an expense (the list keeps it out of the day's
     card, see expenseRuns). Never swiped. -->
{#if expense.is_reimbursement}
    {@render row()}
{:else}
    <SwipeableItem disabled={swipeDisabled} onAction={() => onRequestDelete?.(expense.id)}>
        {@render row()}
    </SwipeableItem>
{/if}

{#snippet row()}
<div
    class="expense-item group/item relative {expense.is_reimbursement ? 'rounded-card border-[1.5px] border-dashed border-input' : ''}"
    data-expense={expense.id}
>
    <button
        type="button"
        aria-haspopup="dialog"
        aria-current={selected ? 'true' : undefined}
        onclick={() => onOpen(expense)}
        class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 focus-ring-inset aria-[current]:bg-primary-soft/60 {expense.is_reimbursement ? 'rounded-[inherit]' : ''}"
    >
        {#if expense.is_reimbursement}
            <!-- Who paid whom, side by side (as wide as an expense's tile). -->
            <span class="flex w-10 shrink-0 items-center" aria-hidden="true">
                <Avatar name={payer?.name ?? ''} record={payer} class="size-6.5 shrink-0 text-[0.5625rem]" />
                <Avatar name={receiver?.name ?? ''} record={receiver} class="-ml-3 size-6.5 shrink-0 text-[0.5625rem] ring-2 ring-background" />
            </span>
        {:else}
            <IconTile tone="muted" class="relative text-foreground">
                {expense.icon || DEFAULT_EXPENSE_EMOJI}
                {#if hasPhotos}
                    <span class="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
                        <Camera class="size-2.5!" />
                    </span>
                {/if}
            </IconTile>
        {/if}

        <span class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-1.5 text-base font-medium">
                <span class="truncate">{expense.is_reimbursement ? reimbursementTitle : expense.description}</span>
                {#if repeats}
                    <Repeat class="h-3.5 w-3.5 shrink-0 text-muted-foreground" role="img" aria-label={frequencyLabel} />
                {/if}
            </span>
            <!-- The type first (money in, reimbursement). In a wide list, who
                 paid and for whom have their columns. -->
            <span class="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground {typeLabel ? '' : '@3xl:hidden'}">
                {#if expense.is_reimbursement}
                    <!-- Its title already says who paid whom. -->
                    <span>{typeLabel}</span>
                {:else}
                    {#if typeLabel}
                        <Badge tone="neutral">
                            <ArrowDownLeft class="h-3 w-3" />
                            {typeLabel}
                        </Badge>
                    {/if}
                    <span class="flex min-w-0 items-center gap-1 @3xl:hidden">
                        <span class="truncate {paidByMe ? 'font-semibold text-foreground' : ''}">{payerLabel}</span>
                        <span aria-hidden="true">·</span>
                        {#if involvesMe}
                            <Badge tone="primary">{peopleLabel}</Badge>
                        {:else}
                            <span class="shrink-0">{people}</span>
                        {/if}
                    </span>
                {/if}
            </span>
        </span>

        <span class="hidden w-40 shrink-0 items-center gap-2 text-sm @3xl:flex">
            {#if payer}
                <Avatar name={payer.name} record={payer} class="h-7 w-7 shrink-0 text-[0.625rem]" />
            {/if}
            <span class="truncate {paidByMe ? 'font-semibold' : 'text-muted-foreground'}">{nameOf(expense.payer, payer?.name)}</span>
        </span>
        <span class="hidden w-44 shrink-0 items-center gap-2 text-sm @3xl:flex">
            {#if beneficiaries.length > 0}
                <span class="flex shrink-0 -space-x-2">
                    {#each beneficiaries.slice(0, 3) as person (person.id)}
                        <Avatar name={person.name} record={person} class="h-7 w-7 text-[0.625rem] ring-2 ring-card" />
                    {/each}
                </span>
            {/if}
            {#if involvesMe && !expense.is_reimbursement}
                <Badge tone="primary" class="min-w-0 truncate">{forLabel}</Badge>
            {:else}
                <span class="truncate text-muted-foreground">{forLabel}</span>
            {/if}
        </span>

        {#if isNew}
            <span class="h-2 w-2 shrink-0 rounded-full bg-primary" role="img" aria-label={$t('expense.list.new')}></span>
        {/if}
        <!-- The room of the hover actions (below), so they cover nothing. -->
        <span class="hidden w-[4.75rem] shrink-0 pointer-fine:@3xl:block" aria-hidden="true"></span>
        <span class="shrink-0 text-right @3xl:w-32">
            <!-- A reimbursement moves no spending: grey, not bold. -->
            <span class="block whitespace-nowrap text-base tabular-nums {expense.is_reimbursement ? 'font-medium text-muted-foreground' : 'font-semibold'}">
                {expense.is_income ? '+' : ''}{formatAmount(expense.amount, currency, $locale)}
            </span>
            {@render approxLine(expense.amount)}
        </span>
    </button>

    <!-- Computers, with a mouse: copy or delete from the line, shown on
         hover (or when a button gets the focus). -->
    {#if !readonly && !expense.is_reimbursement && (onDuplicate || !swipeDisabled)}
        <div class="absolute right-[9.75rem] top-1/2 hidden -translate-y-1/2 gap-1 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 focus-within:opacity-100 pointer-fine:@3xl:flex">
            {#if onDuplicate}
                <button
                    type="button"
                    onclick={() => onDuplicate(expense)}
                    class="flex h-9 w-9 items-center justify-center rounded-control border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                    aria-label={$t('expense.list.duplicate')}
                    title={$t('expense.list.duplicate')}
                >
                    <Copy class="h-4 w-4" />
                </button>
            {/if}
            {#if !swipeDisabled}
                <button
                    type="button"
                    onclick={() => onRequestDelete?.(expense.id)}
                    class="flex h-9 w-9 items-center justify-center rounded-control border bg-card text-destructive shadow-sm transition-colors hover:bg-destructive/10"
                    aria-label={$t('common.delete')}
                    title={$t('common.delete')}
                >
                    <Trash2 class="h-4 w-4" />
                </button>
            {/if}
        </div>
    {/if}
</div>
{/snippet}
