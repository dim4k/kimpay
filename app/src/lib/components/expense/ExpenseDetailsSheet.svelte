<script lang="ts">
    import { ArrowRight, HandCoins, Undo2 } from '@lucide/svelte';
    import { pb } from '#lib/pocketbase.js';
    import { t, locale } from '#lib/i18n.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { parseLocalISODate } from '#lib/utils/date.js';
    import { repeatFrequency } from '#lib/repeat.js';
    import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
    import { formatAmount, DEFAULT_CURRENCY } from '#lib/services/currency.js';
    import { expenseShare, toKimpayAmount } from '#lib/balance.js';
    import { expenseShares, isCustomSplit } from '#lib/split.js';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';
    import Badge from '#lib/components/ui/Badge.svelte';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import type { Expense, Participant } from '#lib/types.js';

    /**
     * An expense to read, not to change: on the read-only link, and for a
     * reimbursement (which can only be cancelled).
     */
    let {
        expense,
        currentUserId,
        participantIds,
        participantsById,
        kimpayCurrency,
        exchangeRates,
        onClose,
        onCancelReimbursement,
    }: {
        expense: Expense | null;
        currentUserId: string | null;
        participantIds: string[];
        /** To name who is left out ("everyone but Tony"). */
        participantsById: ReadonlyMap<string, Participant>;
        kimpayCurrency: string;
        exchangeRates: Record<string, number>;
        onClose: () => void;
        /** A reimbursement in the app: it can be cancelled */
        onCancelReimbursement?: ((expenseId: string) => void) | undefined;
    } = $props();

    let currency = $derived(expense?.currency || DEFAULT_CURRENCY);
    let title = $derived(expense ? (expense.is_reimbursement ? $t('balance.reimbursement') : expense.description) : '');

    // In another currency: "≈ €44.10" next to an amount.
    let rate = $derived(
        expense && currency !== kimpayCurrency && expense.amount > 0 ? toKimpayAmount(expense, kimpayCurrency, exchangeRates) / expense.amount : null
    );
    function approx(value: number): string | null {
        return rate ? `≈ ${formatAmount(value * rate, kimpayCurrency, $locale)}` : null;
    }

    function nameOf(id: string | undefined, name: string | undefined): string {
        if (currentUserId && id === currentUserId) return $t('common.you');
        return name || $t('common.unknown');
    }

    // Each person's share, when the expense is not split equally.
    let shares = $derived(
        expense && isCustomSplit(expense) ? expenseShares(expense, expense.expand?.involved?.map((p) => p.id) ?? expense.involved ?? []) : null
    );
    let involvesMe = $derived(!!expense && !!currentUserId && (expense.involved ?? []).includes(currentUserId));

    // "Everyone (8)", "Everyone but Tony" when one or two are left out,
    // otherwise one chip per person.
    let forSummary = $derived.by(() => {
        if (!expense) return null;
        const count = expense.involved?.length ?? 0;
        if (shares || count < 3) return null;
        const left = participantIds.filter((id) => !(expense.involved ?? []).includes(id));
        if (left.length === 0) return $t('expense.list.everyone', { count: String(count) });
        if (left.length <= 2) {
            const names = left.map((id) => (currentUserId === id ? $t('common.you_in_sentence') : participantsById.get(id)?.name ?? $t('common.unknown'))).join(', ');
            return $t('expense.list.everyone_but', { names });
        }
        return null;
    });

    // My part of an equal split (a custom split shows everyone's part already).
    let myShare = $derived(
        expense && currentUserId && !shares && !expense.is_reimbursement && involvesMe
            ? expenseShare(expense, currentUserId, participantIds)
            : null
    );

    let repeatLine = $derived(
        expense?.repeat_day && !expense.is_reimbursement
            ? [
                  $t(`expense.repeat.${repeatFrequency(expense.repeat_every)}`),
                  expense.repeat_next &&
                      $t('expense.list.next_on', { date: parseLocalISODate(expense.repeat_next).toLocaleDateString($locale, { day: 'numeric', month: 'short' }) }),
              ].filter(Boolean).join(' · ')
            : ''
    );

    function thumbnail(filename: string): string {
        return expense ? pb.files.getURL(expense, filename, { thumb: '100x100' }) : '';
    }

    function openGallery(start: number) {
        if (expense?.photos?.length) modals.gallery({ photos: expense.photos, record: expense, start });
    }
</script>

{#snippet personChip(id: string, name: string | undefined)}
    {@const share = shares?.[id]}
    <Badge tone={currentUserId && id === currentUserId ? 'primary' : 'neutral'}>
        {nameOf(id, name)}{share !== undefined ? ` · ${formatAmount(share, currency, $locale)}` : ''}
    </Badge>
{/snippet}

<Modal isOpen={!!expense} {onClose} variant="sheet" panel label={title}>
    {#if expense}
        <div class="flex items-center gap-3">
            <IconTile size="lg" tone="muted" class="text-foreground">
                {#if expense.is_reimbursement}<HandCoins />{:else}{expense.icon || DEFAULT_EXPENSE_EMOJI}{/if}
            </IconTile>
            <div class="min-w-0 flex-1">
                <ModalHeader {title} align="start" {onClose} />
            </div>
        </div>

        <div class="space-y-1 text-center">
            <p class="text-4xl font-bold tracking-tight tabular-nums">
                {expense.is_income ? '+' : ''}{formatAmount(expense.amount, currency, $locale)}
            </p>
            {#if approx(expense.amount)}
                <p class="text-sm tabular-nums text-muted-foreground">{approx(expense.amount)}</p>
            {/if}
        </div>

        <dl class="divide-y rounded-card border bg-card text-sm">
            {#if expense.is_reimbursement}
                {@const to = expense.expand?.involved?.[0]}
                <div class="flex items-center justify-center gap-2 px-4 py-3 text-base font-medium">
                    <dt class="sr-only">{$t('export.col.from')}</dt>
                    <dd>{nameOf(expense.payer, expense.expand?.payer?.name)}</dd>
                    <ArrowRight class="h-4 w-4 text-muted-foreground" aria-label={$t('balance.pays')} />
                    <dt class="sr-only">{$t('export.col.to')}</dt>
                    <dd>{nameOf(to?.id, to?.name)}</dd>
                </div>
            {/if}
            <div class="flex items-center justify-between gap-3 px-4 py-3">
                <dt class="text-muted-foreground">{$t('expense.form.date_label')}</dt>
                <dd class="font-medium first-letter:uppercase">{parseLocalISODate(expense.date).toLocaleDateString($locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</dd>
            </div>
            {#if !expense.is_reimbursement}
                <div class="flex items-center justify-between gap-3 px-4 py-3">
                    <dt class="text-muted-foreground">{expense.is_income ? $t('expense.list.received_by') : $t('expense.list.paid_by')}</dt>
                    <dd>{@render personChip(expense.payer, expense.expand?.payer?.name)}</dd>
                </div>
                <div class="flex items-start justify-between gap-3 px-4 py-3">
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
                {#if myShare !== null}
                    <div class="flex items-center justify-between gap-3 px-4 py-3">
                        <dt class="text-muted-foreground">{$t('expense.list.your_share')}</dt>
                        <dd class="font-semibold tabular-nums">
                            {formatAmount(myShare, currency, $locale)}
                            {#if approx(myShare)}<span class="font-normal text-muted-foreground">({approx(myShare)})</span>{/if}
                        </dd>
                    </div>
                {/if}
                {#if repeatLine}
                    <div class="flex items-center justify-between gap-3 px-4 py-3">
                        <dt class="text-muted-foreground">{$t('expense.list.repeats')}</dt>
                        <dd class="text-right font-medium">{repeatLine}</dd>
                    </div>
                {/if}
            {/if}
            {#if expense.notes}
                <div class="space-y-1 px-4 py-3">
                    <dt class="text-muted-foreground">{$t('expense.note.label')}</dt>
                    <dd class="whitespace-pre-line break-words text-base">{expense.notes}</dd>
                </div>
            {/if}
        </dl>

        {#if expense.photos?.length}
            <ul class="flex gap-2 overflow-x-auto" aria-label={$t('expense.form.photos_label')}>
                {#each expense.photos as filename, index (filename)}
                    <li class="shrink-0">
                        <button
                            type="button"
                            onclick={() => openGallery(index)}
                            class="block h-16 w-16 overflow-hidden rounded-control border bg-muted transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={$t('expense.list.open_photo', { index: String(index + 1) })}
                        >
                            <img src={thumbnail(filename)} alt="" loading="lazy" class="h-full w-full object-cover" />
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if expense.is_reimbursement && onCancelReimbursement}
            <Button variant="ghost-destructive" class="w-full" onclick={() => onCancelReimbursement(expense!.id)}>
                <Undo2 />
                {$t('expense.reimbursement.undo')}
            </Button>
        {/if}
    {/if}
</Modal>
