<script lang="ts">
    import { LogOut, ChevronRight, Check } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { recentsStore } from '#lib/stores/recents.svelte.js';
    import { storageService } from '#lib/services/storage.js';
    import { kimpayService } from '#lib/services/kimpay.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import EmptyState from '#lib/components/ui/EmptyState.svelte';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
    import SwipeableItem from '#lib/components/ui/SwipeableItem.svelte';
    import Badge from '#lib/components/ui/Badge.svelte';
    import { haptic } from '#lib/utils/haptic.js';
    import { DEFAULT_GROUP_ICON } from '#lib/constants.js';
    import { calculateBalances } from '#lib/balance.js';
    import { DEFAULT_CURRENCY, formatAmount, getExchangeRates } from '#lib/services/currency.js';

    // Offline, only list the Kimpays whose data is cached (they can be opened).
    let cachedIds = $state<string[] | null>(null);
    $effect(() => {
        if (!offlineStore.isOffline) return;
        const ids = recentsStore.recentKimpays.map(k => k.id);
        Promise.all(ids.map(id => storageService.hasKimpayData(id)))
            .then(found => { cachedIds = ids.filter((_, i) => found[i]); });
    });

    let kimpaysToDisplay = $derived(
        offlineStore.isOffline && cachedIds
            ? recentsStore.recentKimpays.filter(k => cachedIds!.includes(k.id))
            : recentsStore.recentKimpays
    );

    interface Summary {
        members: number;
        /** My balance in the group, null without an identity there */
        balance: number | null;
        currency: string;
    }

    // Members and my balance, from the copy of each group cached on this
    // device (groups never opened here have none yet).
    let summaries = $state<Record<string, Summary>>({});
    $effect(() => {
        const ids = kimpaysToDisplay.map(k => k.id);
        let cancelled = false;
        (async () => {
            const rates = await getExchangeRates().catch(() => ({}));
            const entries = await Promise.all(ids.map(async (id): Promise<[string, Summary] | null> => {
                const data = await storageService.getKimpayData(id);
                if (!data?.expand) return null;
                const participants = data.expand.participants_via_kimpay ?? [];
                const expenses = data.expand.expenses_via_kimpay ?? [];
                const currency = data.currency || DEFAULT_CURRENCY;
                const me = data.myParticipantId ?? await storageService.getMyParticipantId(id);
                const balances = calculateBalances(expenses, participants, currency, rates);
                return [id, { members: participants.length, balance: me ? balances[me] ?? null : null, currency }];
            }));
            if (!cancelled) summaries = Object.fromEntries(entries.filter((e) => e !== null));
        })();
        return () => { cancelled = true; };
    });

    function requestLeave(id: string) {
        modals.confirm({
            title: $t('modal.leave.title'),
            description: $t('modal.leave.desc'),
            confirmText: $t('modal.leave.confirm'),
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    // Deletes our participant when possible, otherwise unclaims it.
                    const participantId = await storageService.getMyParticipantId(id);
                    if (participantId) {
                        const result = await kimpayService.leave(id, participantId);
                        if (!result.success) {
                            modals.alert({ message: $t('error.generic'), variant: 'error' });
                            return;
                        }
                    }
                    await recentsStore.forget(id);
                } catch (e) {
                    console.error("Error leaving kimpay", e);
                    modals.alert({ message: $t('error.generic'), variant: 'error' });
                }
            }
        });
    }
</script>

<!-- Only show for logged users OR non-logged users with Kimpays -->
{#if auth.user || kimpaysToDisplay.length > 0}
<section class="space-y-3">
    <h1 class="px-1 text-xl font-bold">{$t('my_kimpays.title')}</h1>

    {#if recentsStore.loading && kimpaysToDisplay.length === 0}
        <ListSkeleton count={2} />
    {:else if kimpaysToDisplay.length === 0}
        <EmptyState description={$t('my_kimpays.empty')} />
    {:else}
        <ListGroup>
            {#each kimpaysToDisplay as k (k.id)}
                {@const summary = summaries[k.id]}
                <SwipeableItem
                    disabled={offlineStore.isOffline}
                    onDelete={() => requestLeave(k.id)}
                    deleteLabel={$t('home.history.leave_tooltip')}
                    deleteIcon={LogOut}
                >
                    <div class="group flex items-center">
                        <a
                            href="/k/{k.id}"
                            data-sveltekit-preload-data="false"
                            onclick={() => haptic('light')}
                            class="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 transition-colors duration-150 hover:bg-muted/50"
                        >
                            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-muted text-2xl" aria-hidden="true">{k.icon || DEFAULT_GROUP_ICON}</span>
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-base font-semibold">{k.name}</span>
                                {#if summary}
                                    <span class="block truncate text-sm text-muted-foreground">{$t('expense.list.people', { count: String(summary.members) })}</span>
                                {/if}
                            </span>
                            {#if summary && summary.balance !== null}
                                {#if Math.abs(summary.balance) < 0.005}
                                    <Badge tone="neutral"><Check class="h-3 w-3" />{$t('home.group.settled')}</Badge>
                                {:else}
                                    <span class="shrink-0 text-right">
                                        <span class="block text-base font-semibold tabular-nums {summary.balance > 0 ? 'text-success' : 'text-warning'}">
                                            {summary.balance > 0 ? '+' : '−'}{formatAmount(Math.abs(summary.balance), summary.currency, $locale)}
                                        </span>
                                        <span class="block text-xs text-muted-foreground">{summary.balance > 0 ? $t('home.group.owed') : $t('home.group.owe')}</span>
                                    </span>
                                {/if}
                            {/if}
                            <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
                        </a>
                        <!-- Pointer devices (no swipe): leave on hover / focus. -->
                        <button
                            type="button"
                            class="mr-2 hidden h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 md:flex md:opacity-0 md:group-hover:opacity-100"
                            onclick={() => requestLeave(k.id)}
                            title={$t('home.history.leave_tooltip')}
                            aria-label={$t('home.history.leave_tooltip')}
                        >
                            <LogOut class="h-4 w-4" />
                        </button>
                    </div>
                </SwipeableItem>
            {/each}
        </ListGroup>
        <p class="px-1 text-xs text-muted-foreground md:hidden">{$t('home.group.swipe_hint')}</p>
    {/if}
</section>
{/if}
