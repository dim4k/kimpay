<script lang="ts">
    import { Pencil, Trash2, Image as ImageIcon, Camera, HandCoins, Undo2 } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { parseLocalISODate } from '#lib/utils/date.js';
    import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
    import { slide } from 'svelte/transition';
    import { goto } from '$app/navigation';
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
        expandedId: string | null;
        kimpayId: string;
        onToggleExpand: (expenseId: string) => void;
        onRequestDelete: (expenseId: string) => void;
        onOpenGallery: (expense: Expense) => void;
        /**
         * `total`: who paid and the amount. `me`: what the expense changes
         * for me on the right ("you owe €12.50"), the amount in the details.
         */
        view?: 'total' | 'me';
    } = $props();

    let isExpanded = $derived(expandedId === expense.id);
    let hasPhotos = $derived(!!expense.photos && expense.photos.length > 0);

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

    function handleKeydown(e: KeyboardEvent) {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(expense.id);
        }
    }

    // Disable swipe for reimbursements or when offline (can't edit)
    let swipeDisabled = $derived(expense.is_reimbursement || offlineStore.isOffline);
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
        <p class="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{text}</p>
    {/if}
{/snippet}

<SwipeableItem
    disabled={swipeDisabled}
    onEdit={() => goto(`/k/${kimpayId}/edit/${expense.id}`)}
    onDelete={() => onRequestDelete(expense.id)}
>
<div
    class="expense-item cursor-pointer outline-hidden focus-visible:bg-muted/60"
    data-expense={expense.id}
    role="button"
    tabindex="0"
    aria-expanded={isExpanded}
    onclick={() => onToggleExpand(expense.id)}
    onkeydown={handleKeydown}
>
    <div class="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/50 {isExpanded ? 'bg-muted/50' : ''}">
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

        <div class="min-w-0 flex-1">
            <p class="truncate text-base font-medium">
                {expense.is_reimbursement ? $t('balance.reimbursement') : expense.description}
            </p>
            <p class="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
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
            </p>
        </div>

        {#if isNew}
            <span class="h-2 w-2 shrink-0 rounded-full bg-primary" role="img" aria-label={$t('expense.list.new')}></span>
        {/if}
        <div class="shrink-0 text-right">
            {#if myReimbursement === 'none'}
                <p class="whitespace-nowrap text-xs text-muted-foreground">{$t('expense.list.not_involved')}</p>
            {:else if myReimbursement}
                <p class="whitespace-nowrap text-xs text-muted-foreground">
                    {myReimbursement === 'got_back' ? $t('expense.list.you_got_back') : $t('expense.list.you_paid_back')}
                </p>
                <p class="whitespace-nowrap text-base font-semibold tabular-nums">{formatAmount(expense.amount, currency, $locale)}</p>
                {@render approxLine(expense.amount)}
            {:else if showImpact}
                <!-- Two words over my amount: what the expense means for me. -->
                {#if impact === undefined}
                    <p class="whitespace-nowrap text-xs text-muted-foreground">{$t('expense.list.not_involved')}</p>
                {:else if isSettled(impact ?? 0)}
                    <p class="whitespace-nowrap text-xs text-muted-foreground">{$t('members.settled')}</p>
                {:else}
                    <p class="whitespace-nowrap text-xs text-muted-foreground">{impact! > 0 ? $t('expense.list.owed_to_you') : $t('expense.list.you_owe')}</p>
                    <p class="whitespace-nowrap text-base font-semibold tabular-nums {impact! > 0 ? 'text-success' : 'text-warning'}">
                        {formatAmount(Math.abs(impact!), currency, $locale)}
                    </p>
                    {@render approxLine(Math.abs(impact!))}
                {/if}
            {:else}
                <p class="whitespace-nowrap text-base font-semibold tabular-nums">
                    {expense.is_income ? '+' : ''}{formatAmount(expense.amount, currency, $locale)}
                </p>
                {@render approxLine(expense.amount)}
            {/if}
        </div>
    </div>

    {#if isExpanded}
        <div class="space-y-3 border-t bg-muted/30 px-4 py-3" transition:slide={{ duration: 150 }}>
            <dl class="space-y-1.5 text-sm">
                <div class="flex items-center justify-between gap-3">
                    <dt class="text-muted-foreground">{$t('expense.form.date_label')}:</dt>
                    <dd class="font-medium">{parseLocalISODate(expense.date).toLocaleDateString($locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</dd>
                </div>
                {#if !expense.is_reimbursement}
                    <div class="flex items-center justify-between gap-3">
                        <dt class="text-muted-foreground">{expense.is_income ? $t('expense.list.received_by') : $t('expense.list.paid_by')}:</dt>
                        <dd>{@render personChip(expense.payer, expense.expand?.payer?.name)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                        <dt class="text-muted-foreground">{$t('expense.list.for')}:</dt>
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
                    {#if myShare !== null}
                        <div class="flex items-center justify-between gap-3">
                            <dt class="text-muted-foreground">{$t('expense.list.your_share')}:</dt>
                            <dd class="font-semibold tabular-nums">
                                {formatAmount(myShare, currency, $locale)}
                                {#if approx(myShare)}<span class="font-normal text-muted-foreground">({approx(myShare)})</span>{/if}
                            </dd>
                        </div>
                    {/if}
                {/if}
            </dl>

            {#if expense.is_reimbursement}
                <Button
                    variant="outline"
                    size="sm"
                    class="w-full text-destructive"
                    onclick={(e: MouseEvent) => { e.stopPropagation(); onRequestDelete(expense.id); }}
                >
                    <Undo2 />
                    {$t('expense.reimbursement.undo')}
                </Button>
            {:else}
                <div class="grid gap-2 {hasPhotos ? 'grid-cols-3' : 'grid-cols-2'}">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={offlineStore.isOffline}
                        onclick={async (e: MouseEvent) => { e.stopPropagation(); await goto(`/k/${kimpayId}/edit/${expense.id}`); }}
                    >
                        <Pencil />
                        {$t('common.edit')}
                    </Button>
                    {#if hasPhotos}
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={offlineStore.isOffline}
                            onclick={(e: MouseEvent) => { e.stopPropagation(); onOpenGallery(expense); }}
                        >
                            <ImageIcon />
                            {$t('expense.form.photos_label')}
                        </Button>
                    {/if}
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-destructive"
                        disabled={offlineStore.isOffline}
                        onclick={(e: MouseEvent) => { e.stopPropagation(); onRequestDelete(expense.id); }}
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
