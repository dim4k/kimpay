<script lang="ts">
    import { untrack } from "svelte";
    import { goto } from "$app/navigation";
    import { ChevronLeft, Minus, Pencil, Plus, ReceiptText, SlidersHorizontal, Trash2, UserPlus, UserRound } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { getErrorMessage } from '#lib/utils/errors.js';
    import { defaultSharesOf, hasJoined } from '#lib/utils/members.js';
    import { NAME_MAX_LENGTH } from '#lib/constants.js';
    import { balanceSign, balanceTone, paidBy, shareOf, type Transaction } from '#lib/balance.js';
    import { DEFAULT_CURRENCY, formatAmount } from '#lib/services/currency.js';
    import type { ActiveKimpay } from '#lib/stores/activeKimpay.svelte.js';
    import type { Participant } from '#lib/types.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import ListRow from '#lib/components/ui/ListRow.svelte';
    import Switch from '#lib/components/ui/Switch.svelte';
    import DebtCard from '#lib/components/balance/DebtCard.svelte';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';

    interface Props {
        /** The member shown (null: closed) */
        participant: Participant | null;
        activeKimpay: ActiveKimpay;
        /** They paid or share an expense: cannot be deleted */
        used: boolean;
        onClose: () => void;
        onDelete: (participant: Participant) => void;
        onOpenProfile: () => void;
        /** Send them their own link (not here yet) */
        onInvite: (participant: Participant) => void;
        /** Record a payment between me and them */
        onSettle: (tx: Transaction) => void;
    }

    let { participant, activeKimpay, used, onClose, onDelete, onOpenProfile, onInvite, onSettle }: Props = $props();

    let myId = $derived(activeKimpay.myParticipantId);
    let isMe = $derived(!!participant && participant.id === myId);
    // Someone else's account: they manage their own name.
    let ownedByOther = $derived(!!participant?.user && participant.user !== auth.user?.id);
    let joined = $derived(!!participant && hasJoined(participant, myId));

    // Where they stand, in the group currency.
    let currency = $derived(activeKimpay.kimpay?.currency || DEFAULT_CURRENCY);
    let expenses = $derived(activeKimpay.expenses);
    let stats = $derived.by(() => {
        if (!participant || expenses.length === 0) return null;
        const rates = activeKimpay.exchangeRates;
        return {
            paid: paidBy(expenses, participant.id, currency, rates),
            share: shareOf(expenses, activeKimpay.participants, participant.id, currency, rates),
            balance: activeKimpay.balances[participant.id] ?? 0,
        };
    });
    // The expenses they paid or share (the list, filtered on them).
    let expenseCount = $derived(
        participant ? expenses.filter((e) => e.payer === participant.id || e.involved?.includes(participant.id)).length : 0
    );

    // A payment suggested between the two of us.
    let tx = $derived(
        participant && myId && !isMe
            ? activeKimpay.transactions.find(
                  (x) => (x.from === myId && x.to === participant.id) || (x.from === participant.id && x.to === myId),
              ) ?? null
            : null
    );

    function seeExpenses() {
        if (!participant) return;
        const id = participant.id;
        onClose();
        goto(`/k/${activeKimpay.id}?person=${id}`, { replaceState: true });
    }

    // Rarely needed settings, each in a panel of the sheet (back to the
    // summary with the chevron); a member opened starts on the summary.
    let panel = $state<'main' | 'defaults' | 'manage'>('main');
    $effect(() => {
        void participantId;
        untrack(() => (panel = 'main'));
    });

    // Typed over, reset to the name for each member opened (not when the
    // list is refreshed, which gives a new object for the same member).
    let participantId = $derived(participant?.id);
    let name = $derived.by(() => {
        void participantId;
        return untrack(() => participant?.name ?? '');
    });
    let isSaving = $state(false);

    async function rename() {
        const next = name.trim();
        if (!participant || !next || next === participant.name) return;
        isSaving = true;
        try {
            await activeKimpay.renameParticipant(participant.id, next);
            toasts.success($t('common.saved'));
            onClose();
        } catch (e) {
            console.error("Failed to rename participant", e);
            toasts.error(getErrorMessage(e, $t));
        } finally {
            isSaving = false;
        }
    }

    // What they count for in new expenses: set by anyone, for anyone.
    let shares = $derived(participant ? defaultSharesOf(participant) : 1);
    let canSetDefaults = $derived(activeKimpay.participants.length > 1 && !offlineStore.isOffline);
    // "Ticked · 2 shares"
    let defaultsSummary = $derived(
        participant?.inactive
            ? $t('members.defaults.summary_out')
            : [$t('members.defaults.summary_in'), $t('members.shares', { count: String(shares) })].join(' · ')
    );

    async function setDefaults(changes: { inactive?: boolean; default_shares?: number }) {
        if (!participant) return;
        try {
            await activeKimpay.setMemberDefaults(participant.id, changes);
        } catch (e) {
            console.error("Failed to change the member's defaults", e);
            toasts.error(getErrorMessage(e, $t));
        }
    }

    // Who the same person may also be: never two accounts.
    let others = $derived(
        participant
            ? activeKimpay.participants.filter((p) => p.id !== participant.id && !(participant.user && p.user && p.user !== participant.user))
            : []
    );

    let canMerge = $derived(others.length > 0 && !ownedByOther && !offlineStore.isOffline);
    let canDelete = $derived(!isMe && !used && !ownedByOther && !offlineStore.isOffline);

    function confirmMerge(into: Participant) {
        if (!participant) return;
        const from = participant;
        onClose();
        modals.confirm({
            title: $t('members.merge.confirm_title', { from: from.name, into: into.name }),
            description: $t('members.merge.confirm_desc', { from: from.name, into: into.name }),
            confirmText: $t('members.merge.confirm'),
            onConfirm: async () => {
                try {
                    await activeKimpay.mergeParticipant(from.id, into.id);
                    toasts.success($t('members.merge.done', { name: into.name }));
                } catch (e) {
                    console.error("Failed to merge participants", e);
                    toasts.error(getErrorMessage(e, $t));
                }
            },
        });
    }
</script>

{#snippet stat(value: string, label: string, tone = '')}
    <div class="min-w-0 rounded-control bg-muted px-3 py-2">
        <p class="truncate text-base font-semibold tabular-nums {tone}">{value}</p>
        <p class="truncate text-xs text-muted-foreground">{label}</p>
    </div>
{/snippet}

<Modal isOpen={!!participant} {onClose} variant="sheet" label={participant?.name ?? ''}>
    {#if participant && panel !== 'main'}
        <div class="flex items-center gap-1">
            <button
                type="button"
                onclick={() => (panel = 'main')}
                class="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-primary transition-colors hover:bg-primary-soft"
                aria-label={$t('common.back')}
                title={$t('common.back')}
            >
                <ChevronLeft class="h-5 w-5" />
            </button>
            <h2 class="min-w-0 flex-1 truncate text-xl font-bold">
                {panel === 'defaults' ? $t('members.defaults.title') : $t('members.manage')}
            </h2>
        </div>

        {#if panel === 'defaults'}
            <ListGroup>
                <ListRow title={$t('members.defaults.include')} subtitle={$t('members.defaults.include_desc')}>
                    {#snippet trailing()}
                        <Switch
                            checked={!participant!.inactive}
                            label={$t('members.defaults.include')}
                            onchange={(v) => setDefaults({ inactive: !v })}
                        />
                    {/snippet}
                </ListRow>
                <ListRow title={$t('members.defaults.shares')} subtitle={$t('members.defaults.shares_desc')}>
                    {#snippet trailing()}
                        <div class="flex shrink-0 items-center gap-1">
                            <Button size="icon-sm" variant="outline" aria-label={$t('members.defaults.less')} disabled={shares <= 1} onclick={() => setDefaults({ default_shares: shares - 1 })}>
                                <Minus />
                            </Button>
                            <span class="w-6 text-center text-base font-semibold tabular-nums" data-testid="member-shares">{shares}</span>
                            <Button size="icon-sm" variant="outline" aria-label={$t('members.defaults.more')} disabled={shares >= 20} onclick={() => setDefaults({ default_shares: shares + 1 })}>
                                <Plus />
                            </Button>
                        </div>
                    {/snippet}
                </ListRow>
            </ListGroup>
        {:else}
            <div class="space-y-2">
                <Label for="member-name">{$t('members.name')}</Label>
                {#if ownedByOther}
                    <p class="text-sm text-muted-foreground">{$t('members.name_from_account')}</p>
                {:else}
                    <div class="flex gap-2">
                        <Input
                            id="member-name"
                            bind:value={name}
                            maxlength={NAME_MAX_LENGTH}
                            onkeydown={(e) => e.key === 'Enter' && rename()}
                        />
                        <Button onclick={rename} loading={isSaving} disabled={!name.trim() || name.trim() === participant.name}>
                            {$t('common.save')}
                        </Button>
                    </div>
                {/if}
            </div>

            {#if canMerge}
                <div class="space-y-2">
                    <Label tag="span">{$t('members.merge.label')}</Label>
                    <p class="text-sm text-muted-foreground">{$t('members.merge.desc', { name: participant.name })}</p>
                    <div class="flex flex-wrap gap-2">
                        {#each others as other (other.id)}
                            <button
                                type="button"
                                onclick={() => confirmMerge(other)}
                                class="flex h-10 items-center gap-2 rounded-full border border-input bg-card pl-1 pr-3.5 text-sm font-medium transition-colors duration-150 hover:bg-muted"
                            >
                                <Avatar name={other.name} record={other} class="h-8 w-8 text-[0.6875rem]" />
                                {other.name}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if canDelete}
                <Button variant="ghost-destructive" class="w-full" onclick={() => { const p = participant!; onClose(); onDelete(p); }}>
                    <Trash2 />
                    {$t('modal.delete_participant.title')}
                </Button>
            {/if}
        {/if}
    {:else if participant}
        <div class="flex items-center gap-3">
            <Avatar name={participant.name} record={participant} class="h-12 w-12 shrink-0 text-base" />
            <div class="min-w-0 flex-1">
                <ModalHeader
                    title={participant.name}
                    description={participant.inactive ? $t('members.inactive') : isMe ? undefined : joined ? $t('members.joined') : $t('members.not_joined')}
                    align="start"
                    {onClose}
                />
            </div>
        </div>

        {#if stats}
            {@const tone = balanceTone(stats.balance)}
            <div class="grid grid-cols-3 gap-2" data-testid="member-stats">
                {@render stat(formatAmount(stats.paid, currency, $locale), $t('members.stats.paid'))}
                {@render stat(formatAmount(stats.share, currency, $locale), $t('members.stats.share'))}
                {@render stat(
                    `${balanceSign(stats.balance)}${formatAmount(Math.abs(stats.balance), currency, $locale)}`,
                    $t('members.stats.balance'),
                    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : '',
                )}
            </div>
        {/if}

        {#if tx}
            <DebtCard
                other={participant}
                iOwe={tx.from === myId}
                amount={formatAmount(tx.amount, tx.currency, $locale)}
                payAmount={tx.amount}
                payCurrency={tx.currency}
                onSettle={() => onSettle(tx!)}
            />
        {/if}

        {#if (!joined && !participant.inactive) || expenseCount > 0 || isMe}
            <div class="flex flex-col gap-2">
                {#if !joined && !participant.inactive}
                    <Button class="w-full" onclick={() => onInvite(participant!)}>
                        <UserPlus />
                        {$t('members.invite_named', { name: participant.name })}
                    </Button>
                {/if}
                {#if expenseCount > 0}
                    <Button variant="outline" class="w-full" onclick={seeExpenses}>
                        <ReceiptText />
                        {$t('members.see_expenses', { count: String(expenseCount) })}
                    </Button>
                {/if}
                {#if isMe}
                    <Button variant="secondary" class="w-full" onclick={() => { onClose(); onOpenProfile(); }}>
                        <UserRound />
                        {$t('settings.my_profile')}
                    </Button>
                {/if}
            </div>
        {/if}

        <!-- Rarely needed: one line each, opening its panel. -->
        {#if canSetDefaults || !ownedByOther || canMerge || canDelete}
            <ListGroup>
                {#if canSetDefaults}
                    <ListRow icon={SlidersHorizontal} title={$t('members.defaults.title')} subtitle={defaultsSummary} onclick={() => (panel = 'defaults')} />
                {/if}
                {#if !ownedByOther || canMerge || canDelete}
                    <ListRow icon={Pencil} title={$t('members.manage_row')} onclick={() => (panel = 'manage')} />
                {/if}
            </ListGroup>
        {/if}
    {/if}
</Modal>
