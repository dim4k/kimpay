<script lang="ts">
    import { Pencil, Trash2, Image as ImageIcon, Camera, HandCoins, Undo2 } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { parseLocalISODate } from '#lib/utils/date.js';
    import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
    import { slide } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { formatAmount, DEFAULT_CURRENCY } from '#lib/services/currency.js';
    import { expenseShare } from '#lib/balance.js';
    import SwipeableItem from '#lib/components/ui/SwipeableItem.svelte';
    import Badge from '#lib/components/ui/Badge.svelte';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import type { Expense } from '#lib/types.js';
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
    }: {
        expense: Expense;
        currentUserId: string | null;
        /** All participants of the group (to compute each share) */
        participantIds: string[];
        expandedId: string | null;
        kimpayId: string;
        onToggleExpand: (expenseId: string) => void;
        onRequestDelete: (expenseId: string) => void;
        onOpenGallery: (expense: Expense) => void;
    } = $props();

    let isExpanded = $derived(expandedId === expense.id);
    let hasPhotos = $derived(!!expense.photos && expense.photos.length > 0);

    // Each person's share, shown when the expense is not split equally.
    let shares = $derived(
        isCustomSplit(expense) ? expenseShares(expense, expense.expand?.involved?.map((p) => p.id) ?? expense.involved ?? []) : null
    );
    let currency = $derived(expense.currency || DEFAULT_CURRENCY);

    function nameOf(id: string | undefined, name: string | undefined): string {
        if (currentUserId && id === currentUserId) return $t('common.you');
        return name || $t('common.unknown');
    }

    /** Same, inside a sentence ("Paid by you"). */
    function inSentence(id: string | undefined, name: string | undefined): string {
        return currentUserId && id === currentUserId ? $t('common.you_in_sentence') : nameOf(id, name);
    }

    let paidByMe = $derived(!!currentUserId && expense.payer === currentUserId);

    // What this expense changes to my balance, in its currency: what I
    // advanced minus my share (the other way round for money received).
    // null when there is nothing to say (no identity in the group, or a
    // reimbursement: its line already says who paid whom), undefined when it
    // does not concern me.
    let impact = $derived.by((): number | null | undefined => {
        if (!currentUserId || expense.is_reimbursement) return null;
        const involvedMe = (expense.involved ?? []).includes(currentUserId);
        if (!paidByMe && !involvedMe) return undefined;
        const paid = paidByMe ? expense.amount : 0;
        const share = involvedMe ? expenseShare(expense, currentUserId, participantIds) : 0;
        return (expense.is_income ? -1 : 1) * (paid - share);
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

<SwipeableItem
    disabled={swipeDisabled}
    onEdit={() => goto(`/k/${kimpayId}/edit/${expense.id}`)}
    onDelete={() => onRequestDelete(expense.id)}
>
<div
    class="expense-item cursor-pointer outline-hidden focus-visible:bg-muted/60"
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
            <p class="truncate text-sm text-muted-foreground">
                {#if expense.is_reimbursement}
                    {payerLabel}
                {:else}
                    <span class={paidByMe ? 'font-semibold text-primary' : ''}>{payerLabel}</span>{` · ${people}`}
                {/if}
            </p>
        </div>

        <div class="shrink-0 text-right">
            <p class="text-base font-semibold tabular-nums">
                {expense.is_income ? '+' : ''}{formatAmount(expense.amount, currency, $locale)}
            </p>
            {#if impact === undefined}
                <p class="text-xs text-muted-foreground">{$t('expense.list.not_involved')}</p>
            {:else if impact !== null && Math.abs(impact) >= 0.005}
                {@const amount = formatAmount(Math.abs(impact), currency, $locale)}
                <!-- "you lent / you borrowed", the words of shared accounts;
                     money received is held for the others, or owed by them. -->
                <p class="whitespace-nowrap text-xs font-semibold tabular-nums {impact > 0 ? 'text-success' : 'text-warning'}">
                    {#if expense.is_income}
                        {impact > 0 ? $t('expense.list.income_owed', { amount }) : $t('expense.list.income_to_share', { amount })}
                    {:else}
                        {impact > 0 ? $t('expense.list.lent', { amount }) : $t('expense.list.borrowed', { amount })}
                    {/if}
                </p>
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
                            {#if expense.expand?.involved}
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
                            <dd class="font-semibold tabular-nums">{formatAmount(myShare, currency, $locale)}</dd>
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
