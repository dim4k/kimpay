<script lang="ts">
    import { Pencil, Trash2, Camera, Copy, HandCoins, Repeat, Undo2 } from "@lucide/svelte";
    import { pb } from '#lib/pocketbase.js';
    import { t, locale } from '#lib/i18n.js';
    import { parseLocalISODate } from '#lib/utils/date.js';
    import { repeatFrequency } from '#lib/repeat.js';
    import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
    import { slide } from 'svelte/transition';
    import { openExpenseSheet } from '#lib/expenseSheet.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { formatAmount, DEFAULT_CURRENCY } from '#lib/services/currency.js';
    import { expenseImpact, expenseShare, isSettled, toKimpayAmount } from '#lib/balance.js';
    import SwipeableItem from '#lib/components/ui/SwipeableItem.svelte';
    import Badge from '#lib/components/ui/Badge.svelte';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import type { Expense, Participant } from '#lib/types.js';
    import { expenseShares, isCustomSplit } from '#lib/split.js';

    let {
        expense,
        currentUserId,
        participantIds,
        expandedId,
        kimpayId,
        onToggleExpand,
        onRequestDelete,
        onOpenGallery,
        view = 'total',
        participantsById,
        kimpayCurrency,
        exchangeRates,
        isNew = false,
        readonly = false,
    }: {
        expense: Expense;
        currentUserId: string | null;
        /** All participants of the group (to compute each share) */
        participantIds: string[];
        /** To name who is left out ("everyone but Tony"). */
        participantsById: ReadonlyMap<string, Participant>;
        /** Amounts in another currency also show their value in this one. */
        kimpayCurrency: string;
        exchangeRates: Record<string, number>;
        /** Added by someone else since my last visit. */
        isNew?: boolean;
        /** Read-only link: the details, without any action */
        readonly?: boolean;
        expandedId: string | null;
        kimpayId: string;
        onToggleExpand: (expenseId: string) => void;
        onRequestDelete: (expenseId: string) => void;
        /** Opens the photos of the expense, on the one at `index` */
        onOpenGallery: (expense: Expense, index: number) => void;
        /**
         * `total`: who paid and the amount. `me`: what the expense changes
         * for me on the right ("you owe €12.50"), the amount in the details.
         */
        view?: 'total' | 'me';
    } = $props();

    let isExpanded = $derived(expandedId === expense.id);

    // The form opens over the list: the expense folds, as it was before.
    function openFolded(target: { expenseId?: string; from?: string }) {
        onToggleExpand(expense.id);
        openExpenseSheet(kimpayId, target);
    }
    let hasPhotos = $derived(!!expense.photos && expense.photos.length > 0);
    // Copied by the server this often (the latest of its series).
    let repeats = $derived(!!expense.repeat_day && !expense.is_reimbursement);
    let frequencyLabel = $derived($t(`expense.repeat.${repeatFrequency(expense.repeat_every)}`));
    // "Every month · next on Nov 14"
    let repeatLine = $derived(
        [
            frequencyLabel,
            expense.repeat_next &&
                $t('expense.list.next_on', { date: parseLocalISODate(expense.repeat_next).toLocaleDateString($locale, { day: 'numeric', month: 'short' }) }),
        ].filter(Boolean).join(' · ')
    );

    // Each person's share, shown when the expense is not split equally.
    let shares = $derived(
        isCustomSplit(expense) ? expenseShares(expense, expense.expand?.involved?.map((p) => p.id) ?? expense.involved ?? []) : null
    );
    let currency = $derived(expense.currency || DEFAULT_CURRENCY);

    // In another currency: "≈ €44.10" under an amount of the expense.
    let rate = $derived(
        currency !== kimpayCurrency && expense.amount > 0 ? toKimpayAmount(expense, kimpayCurrency, exchangeRates) / expense.amount : null
    );
    function approx(value: number): string | null {
        return rate ? `≈ ${formatAmount(value * rate, kimpayCurrency, $locale)}` : null;
    }

    // Who it is for, in the details: "Everyone (8)", "Everyone but Tony" when
    // one or two are left out, otherwise one chip per person.
    let left = $derived(participantIds.filter((id) => !(expense.involved ?? []).includes(id)));
    let forSummary = $derived.by(() => {
        const count = expense.involved?.length ?? 0;
        if (shares || count < 3) return null;
        if (left.length === 0) return $t('expense.list.everyone', { count: String(count) });
        if (left.length <= 2) {
            const names = left.map((id) => inSentence(id, participantsById.get(id)?.name)).join(', ');
            return $t('expense.list.everyone_but', { names });
        }
        return null;
    });

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

    // "Paid by Laetitia", or "Paid by you" highlighted: what I paid stands out.
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

    // My part of an equal split, in the details (a custom split already shows
    // everyone's part next to their name).
    let myShare = $derived(
        currentUserId && !shares && !expense.is_reimbursement && (expense.involved ?? []).includes(currentUserId)
            ? expenseShare(expense, currentUserId, participantIds)
            : null
    );

    function thumbnail(filename: string): string {
        return pb.files.getURL(expense, filename, { thumb: '100x100' });
    }

    // Disable swipe for reimbursements or when offline (can't edit)
    let swipeDisabled = $derived(readonly || expense.is_reimbursement || offlineStore.isOffline);
</script>

{#snippet personChip(id: string, name: string | undefined)}
    {@const share = shares?.[id]}
    <Badge tone={currentUserId && id === currentUserId ? 'primary' : 'neutral'}>
        {nameOf(id, name)}{share !== undefined ? ` · ${formatAmount(share, currency, $locale)}` : ''}
    </Badge>
{/snippet}

{#snippet approxLine(value: number)}
    {@const text = approx(value)}
    {#if text}
        <span class="block whitespace-nowrap text-xs tabular-nums text-muted-foreground">{text}</span>
    {/if}
{/snippet}

<SwipeableItem
    disabled={swipeDisabled}
    onEdit={() => openExpenseSheet(kimpayId, { expenseId: expense.id })}
    onDelete={() => onRequestDelete(expense.id)}
>
<div class="expense-item" data-expense={expense.id}>
    <!-- The line opens its details; the actions live in them, outside the button. -->
    <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls="details-{expense.id}"
        onclick={() => onToggleExpand(expense.id)}
        class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 focus-ring-inset {isExpanded ? 'bg-muted/50' : ''}"
    >
        <IconTile tone={expense.is_reimbursement ? 'success' : 'muted'} class="relative {expense.is_reimbursement ? '' : 'text-foreground'}">
            {#if expense.is_reimbursement}
                <HandCoins />
            {:else}
                {expense.icon || DEFAULT_EXPENSE_EMOJI}
            {/if}
            {#if hasPhotos && !isExpanded}
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
                    <span class="truncate {paidByMe ? 'font-semibold text-primary' : ''}">{paidAmount}</span>
                {:else}
                    <span class="truncate {paidByMe ? 'font-semibold text-primary' : ''}">{payerLabel}</span>
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

    {#if isExpanded}
        <div id="details-{expense.id}" class="space-y-3 border-t bg-muted/30 px-4 py-3" transition:slide={{ duration: 150 }}>
            <dl class="space-y-1.5 text-sm">
                <div class="flex items-center justify-between gap-3">
                    <dt class="text-muted-foreground">{$t('expense.form.date_label')}</dt>
                    <dd class="font-medium">{parseLocalISODate(expense.date).toLocaleDateString($locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</dd>
                </div>
                {#if !expense.is_reimbursement}
                    <div class="flex items-center justify-between gap-3">
                        <dt class="text-muted-foreground">{expense.is_income ? $t('expense.list.received_by') : $t('expense.list.paid_by')}</dt>
                        <dd>{@render personChip(expense.payer, expense.expand?.payer?.name)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                        <dt class="text-muted-foreground">{$t('expense.list.for')}</dt>
                        <dd class="flex flex-wrap justify-end gap-1">
                            {#if forSummary}
                                <Badge tone={involvesMe ? 'primary' : 'neutral'}>{forSummary}</Badge>
                            {:else if expense.expand?.involved}
                                {#each expense.expand.involved as p (p.id)}
                                    {@render personChip(p.id, p.name)}
                                {/each}
                            {:else}
                                <span class="text-muted-foreground">{$t('expense.no_participants')}</span>
                            {/if}
                        </dd>
                    </div>
                    {#if repeats}
                        <div class="flex items-center justify-between gap-3">
                            <dt class="text-muted-foreground">{$t('expense.list.repeats')}</dt>
                            <dd class="text-right font-medium">
                                {repeatLine}
                            </dd>
                        </div>
                    {/if}
                    {#if myShare !== null}
                        <div class="flex items-center justify-between gap-3">
                            <dt class="text-muted-foreground">{$t('expense.list.your_share')}</dt>
                            <dd class="font-semibold tabular-nums">
                                {formatAmount(myShare, currency, $locale)}
                                {#if approx(myShare)}<span class="font-normal text-muted-foreground">({approx(myShare)})</span>{/if}
                            </dd>
                        </div>
                    {/if}
                {/if}
            </dl>

            {#if hasPhotos}
                <ul class="flex gap-2 overflow-x-auto" aria-label={$t('expense.form.photos_label')}>
                    {#each expense.photos ?? [] as filename, index (filename)}
                        <li class="shrink-0">
                            <button
                                type="button"
                                onclick={() => onOpenGallery(expense, index)}
                                class="block h-16 w-16 overflow-hidden rounded-control border bg-muted transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={$t('expense.list.open_photo', { index: String(index + 1) })}
                            >
                                <img src={thumbnail(filename)} alt="" loading="lazy" class="h-full w-full object-cover" />
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}

            {#if readonly}
                <!-- Read-only link: nothing to change. -->
            {:else if expense.is_reimbursement}
                <Button
                    variant="outline"
                    class="w-full text-destructive"
                    onclick={() => onRequestDelete(expense.id)}
                >
                    <Undo2 />
                    {$t('expense.reimbursement.undo')}
                </Button>
            {:else}
                <div class="grid grid-cols-3 gap-2">
                    <Button
                        variant="outline"
                        class="px-3"
                        disabled={offlineStore.isOffline}
                        onclick={() => openFolded({ expenseId: expense.id })}
                    >
                        <Pencil />
                        {$t('common.edit')}
                    </Button>
                    <!-- The same again (breakfast, fuel...): a new expense, filled in. -->
                    <Button
                        variant="outline"
                        class="px-3"
                        onclick={() => openFolded({ from: expense.id })}
                    >
                        <Copy />
                        {$t('expense.list.duplicate')}
                    </Button>
                    <Button
                        variant="outline"
                        class="px-3 text-destructive"
                        disabled={offlineStore.isOffline}
                        onclick={() => onRequestDelete(expense.id)}
                    >
                        <Trash2 />
                        {$t('common.delete')}
                    </Button>
                </div>
            {/if}
        </div>
    {/if}
</div>
</SwipeableItem>
