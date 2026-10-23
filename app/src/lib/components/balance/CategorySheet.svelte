<script lang="ts">
    import { goto } from "$app/navigation";
    import { ReceiptText } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { categoryColor, DEFAULT_EXPENSE_EMOJI, EMOJI_CATEGORIES, type EmojiCategoryKey } from '#lib/constants.js';
    import { categoryDetail } from '#lib/stats.js';
    import { convert, DEFAULT_CURRENCY, formatAmount } from '#lib/services/currency.js';
    import { dayLabel } from '#lib/utils/date.js';
    import { openExpenseSheet } from '#lib/expenseSheet.js';
    import type { ActiveKimpay } from '#lib/stores/activeKimpay.svelte.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';

    interface Props {
        /** The category shown (null: closed) */
        category: EmojiCategoryKey | null;
        /** Its part of the spending shown on the page (the group's, or mine) */
        share: number;
        /** The group's spending, or my part of it: as on the page */
        view: 'total' | 'me';
        displayCurrency: string;
        activeKimpay: ActiveKimpay;
        onClose: () => void;
    }

    let { category, share, view, displayCurrency, activeKimpay, onClose }: Props = $props();

    let myId = $derived(activeKimpay.myParticipantId);
    let currency = $derived(activeKimpay.kimpay?.currency || DEFAULT_CURRENCY);
    let detail = $derived(
        category
            ? categoryDetail(
                  activeKimpay.expenses,
                  category,
                  currency,
                  activeKimpay.exchangeRates,
                  activeKimpay.participants.map((p) => p.id),
                  myId ?? undefined,
              )
            : null
    );
    let title = $derived(category ? $t(EMOJI_CATEGORIES[category]!.labelKey) : '');
    let percent = $derived(new Intl.NumberFormat($locale, { style: 'percent', maximumFractionDigits: 0 }));

    function money(amount: number): string {
        return formatAmount(convert(amount, currency, displayCurrency, activeKimpay.exchangeRates), displayCurrency, $locale);
    }

    function payerName(id: string): string {
        return id === myId ? $t('common.you') : activeKimpay.participantsById.get(id)?.name || $t('common.unknown');
    }

    function day(date: string): string {
        return dayLabel(date.slice(0, 10), $locale, { today: $t('datepicker.today'), yesterday: $t('date.yesterday') }, true);
    }

    // The sheet gives way to the expense, or to the list filtered on the category.
    function openExpense(id: string) {
        onClose();
        openExpenseSheet(activeKimpay.id, { expenseId: id });
    }

    function seeExpenses() {
        if (!category) return;
        const key = category;
        onClose();
        goto(`/k/${activeKimpay.id}?category=${key}`, { replaceState: true });
    }
</script>

<Modal isOpen={!!category} {onClose} variant="sheet" panel label={title}>
    {#if category && detail}
        <div class="flex items-center gap-3">
            <IconTile size="lg">{EMOJI_CATEGORIES[category]!.emojis[0]}</IconTile>
            <div class="min-w-0 flex-1">
                <ModalHeader
                    {title}
                    description={$t('expense.list.count', { count: String(detail.count) })}
                    align="start"
                    {onClose}
                />
            </div>
        </div>

        <div class="space-y-2" data-testid="category-amounts">
            <div class="flex items-baseline justify-between gap-3">
                <span class="text-display font-bold tabular-nums">{money(view === 'me' ? detail.mine : detail.total)}</span>
                <span class="text-sm text-muted-foreground">
                    {$t(view === 'me' ? 'balance.category.of_mine' : 'balance.category.of_total', { percent: percent.format(share) })}
                </span>
            </div>
            <span class="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span class="block h-full rounded-full" style="width: {Math.max(share * 100, 2)}%; background-color: {categoryColor(category)}"></span>
            </span>
            {#if view === 'me'}
                <p class="text-sm text-muted-foreground">{$t('balance.category.group_total', { amount: money(detail.total) })}</p>
            {:else if myId}
                <p class="text-sm text-muted-foreground">{$t('balance.category.my_share', { amount: money(detail.mine) })}</p>
            {/if}
        </div>

        {#if detail.biggest.length > 0}
            <div class="space-y-1">
                <h3 class="text-sm font-semibold text-muted-foreground">{$t('balance.category.biggest')}</h3>
                <ul class="divide-y divide-border">
                    {#each detail.biggest as { expense, amount } (expense.id)}
                        <li>
                            <button
                                type="button"
                                onclick={() => openExpense(expense.id)}
                                class="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-2 text-left transition-colors duration-150 hover:bg-muted/60 focus-ring-inset"
                            >
                                <span class="w-6 shrink-0 text-center text-lg" aria-hidden="true">{expense.icon || DEFAULT_EXPENSE_EMOJI}</span>
                                <span class="flex min-w-0 flex-1 flex-col">
                                    <span class="truncate text-base">{expense.description}</span>
                                    <span class="truncate text-xs text-muted-foreground">
                                        <span class="capitalize">{day(expense.date)}</span> · {$t('expense.list.paid_by')} {payerName(expense.payer)}
                                    </span>
                                </span>
                                <span class="shrink-0 text-base font-semibold tabular-nums">{money(amount)}</span>
                            </button>
                        </li>
                    {/each}
                </ul>
                {#if detail.count > detail.biggest.length}
                    <p class="pt-1 text-sm text-muted-foreground">{$t('balance.category.more', { count: String(detail.count - detail.biggest.length) })}</p>
                {/if}
            </div>
        {/if}

        <Button class="w-full" onclick={seeExpenses}>
            <ReceiptText />
            {$t('balance.category.see', { count: String(detail.count) })}
        </Button>
    {/if}
</Modal>
