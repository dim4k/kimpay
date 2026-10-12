<script lang="ts">
    import { Archive, ArchiveRestore, ChevronDown, ChevronRight, X } from "@lucide/svelte";
    import { slide } from 'svelte/transition';
    import { t, locale } from '#lib/i18n.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { recentsStore } from '#lib/stores/recents.svelte.js';
    import { archiveStore } from '#lib/stores/archive.svelte.js';
    import { storageService } from '#lib/services/storage.js';
    import { kimpayService } from '#lib/services/kimpay.js';
    import { getExchangeRates } from '#lib/services/currency.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import { auth } from '#lib/stores/auth.svelte.js';
    import EmptyState from '#lib/components/ui/EmptyState.svelte';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
    import SwipeableItem from '#lib/components/ui/SwipeableItem.svelte';
    import Badge from '#lib/components/ui/Badge.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { haptic } from '#lib/utils/haptic.js';
    import { relativeDay } from '#lib/utils/date.js';
    import { getErrorMessage } from '#lib/utils/errors.js';
    import { prefs } from '#lib/utils/prefs.js';
    import { calculateBalances, isSettled } from '#lib/balance.js';
    import { DEFAULT_GROUP_ICON, STORAGE_KEYS } from '#lib/constants.js';
    import type { Expense, Kimpay, RecentKimpay } from '#lib/types.js';

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

    // Done with a group: archived, folded below the others.
    let activeGroups = $derived(kimpaysToDisplay.filter(k => !archiveStore.has(k.id)));
    let archivedGroups = $derived(kimpaysToDisplay.filter(k => archiveStore.has(k.id)));
    let isArchiveOpen = $state(false);

    interface Summary {
        members: number;
        /** Expenses added by others since my last visit on this device */
        news: number;
        /** Creation date of the latest expense, null without any */
        lastActivity: string | null;
        /** Everyone is even (and there was something to settle) */
        settled: boolean;
    }

    type ExpenseStamp = Pick<Expense, 'id' | 'created' | 'created_by'>;

    function latest(expenses: ExpenseStamp[]): string | null {
        return expenses.reduce<string | null>((max, e) => (!max || e.created > max ? e.created : max), null);
    }

    /** The group's expenses on the server, reduced to what tells them apart. */
    async function fetchStamps(id: string): Promise<ExpenseStamp[] | null> {
        try {
            const record = await kimpayService.getWithData(
                id,
                'id,expand.expenses_via_kimpay.id,expand.expenses_via_kimpay.created,expand.expenses_via_kimpay.created_by',
            );
            return record.expand?.expenses_via_kimpay ?? [];
        } catch {
            return null;
        }
    }

    function isAllSettled(data: Kimpay, rates: Record<string, number>): boolean {
        const expenses = data.expand!.expenses_via_kimpay ?? [];
        if (expenses.length === 0) return false;
        const balances = calculateBalances(expenses, data.expand!.participants_via_kimpay ?? [], data.currency, rates);
        return Object.values(balances).every(isSettled);
    }

    // The copy of each group cached on this device is written by the group
    // page only, so it is what I saw on my last visit: anything on the server
    // that it lacks is new (groups never opened here have no copy yet).
    let summaries = $state<Record<string, Summary>>({});
    $effect(() => {
        const ids = kimpaysToDisplay.map(k => k.id);
        const online = !offlineStore.isOffline;
        let cancelled = false;
        (async () => {
            const [cachedData, rates] = await Promise.all([
                Promise.all(ids.map(id => storageService.getKimpayData(id))),
                getExchangeRates().catch(() => ({})),
            ]);
            const cached = cachedData.filter((data) => !!data?.expand) as Kimpay[];
            if (cancelled) return;
            // The cached copy first (instant), then what changed since.
            summaries = Object.fromEntries(cached.map((data) => [data.id, {
                members: data.expand!.participants_via_kimpay?.length ?? 0,
                news: 0,
                lastActivity: latest(data.expand!.expenses_via_kimpay ?? []),
                settled: isAllSettled(data, rates),
            }]));
            if (!online) return;
            await Promise.all(cached.map(async (data) => {
                const fresh = await fetchStamps(data.id);
                const summary = summaries[data.id];
                if (cancelled || !fresh || !summary) return;
                const seen = new Set((data.expand!.expenses_via_kimpay ?? []).map(e => e.id));
                const me = data.myParticipantId || null;
                summary.news = fresh.filter(e => !seen.has(e.id) && e.created_by !== me).length;
                summary.lastActivity = latest(fresh);
            }));
        })();
        return () => { cancelled = true; };
    });

    async function setArchived(k: RecentKimpay, archived: boolean) {
        haptic('light');
        try {
            await archiveStore.set(k.id, archived);
            toasts.success($t(archived ? 'home.archive.done' : 'home.archive.restored', { name: k.name }));
        } catch (e) {
            console.error("Failed to archive", e);
            toasts.error(getErrorMessage(e, $t));
        }
    }

    // A group everyone settled, quiet for a month: offer to archive it (once).
    const MONTH = 30 * 24 * 60 * 60 * 1000;
    let dismissed = $state<string[]>([]);
    let suggested = $derived(
        activeGroups.find((k) => {
            const summary = summaries[k.id];
            if (!summary?.settled || !summary.lastActivity || dismissed.includes(k.id)) return false;
            if (Date.now() - new Date(summary.lastActivity).getTime() < MONTH) return false;
            return prefs.get(`${STORAGE_KEYS.ARCHIVE_SUGGESTION_DISMISSED_PREFIX}${k.id}`) !== 'true';
        }) ?? null
    );

    function dismissSuggestion(id: string) {
        dismissed = [...dismissed, id];
        prefs.set(`${STORAGE_KEYS.ARCHIVE_SUGGESTION_DISMISSED_PREFIX}${id}`, 'true');
    }

    // The swipe is explained on the first two visits, then left to be known.
    const hintShown = Number(prefs.get(STORAGE_KEYS.SWIPE_HINT_SHOWN) ?? 0);
    const showSwipeHint = hintShown < 2;
    let hintCounted = false;
    $effect(() => {
        if (hintCounted || !showSwipeHint || activeGroups.length === 0) return;
        hintCounted = true;
        prefs.set(STORAGE_KEYS.SWIPE_HINT_SHOWN, String(hintShown + 1));
    });
</script>

{#snippet groupRow(k: RecentKimpay, archived: boolean)}
    {@const summary = summaries[k.id]}
    <SwipeableItem
        disabled={offlineStore.isOffline && !!auth.user}
        onDelete={() => setArchived(k, !archived)}
        deleteLabel={archived ? $t('home.archive.restore') : $t('home.archive.action')}
        deleteIcon={archived ? ArchiveRestore : Archive}
    >
        <div class="group flex items-center">
            <a
                href="/k/{k.id}"
                data-sveltekit-preload-data="false"
                onclick={() => haptic('light')}
                class="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 transition-colors duration-150 hover:bg-muted/50"
            >
                <IconTile>{k.icon || DEFAULT_GROUP_ICON}</IconTile>
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-base {summary?.news ? 'font-semibold' : 'font-medium'}">{k.name}</span>
                    {#if summary}
                        <span class="block truncate text-sm text-muted-foreground">
                            {[
                                $t('expense.list.people', { count: String(summary.members) }),
                                summary.lastActivity && relativeDay(summary.lastActivity, $locale),
                            ].filter(Boolean).join(' · ')}
                        </span>
                    {/if}
                </span>
                {#if summary?.news}
                    <Badge tone="solid">
                        {summary.news === 1 ? $t('home.group.new_one') : $t('home.group.new_many', { count: String(summary.news) })}
                    </Badge>
                {/if}
                <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
            <!-- Pointer devices (no swipe): on hover / focus. -->
            <button
                type="button"
                class="mr-2 hidden h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 md:flex md:opacity-0 md:group-hover:opacity-100"
                onclick={() => setArchived(k, !archived)}
                title={archived ? $t('home.archive.restore') : $t('home.archive.action')}
                aria-label={archived ? $t('home.archive.restore') : $t('home.archive.action')}
            >
                {#if archived}<ArchiveRestore class="h-4 w-4" />{:else}<Archive class="h-4 w-4" />{/if}
            </button>
        </div>
    </SwipeableItem>
{/snippet}

<!-- Only show for logged users OR non-logged users with Kimpays -->
{#if auth.user || kimpaysToDisplay.length > 0}
<section class="space-y-3">
    <h1 class="px-1 text-xl font-bold">{$t('my_kimpays.title')}</h1>

    {#if recentsStore.loading && kimpaysToDisplay.length === 0}
        <ListSkeleton count={2} />
    {:else if kimpaysToDisplay.length === 0}
        <EmptyState description={$t('my_kimpays.empty')} />
    {:else}
        {#if suggested}
            <div class="flex items-center gap-3 rounded-card bg-primary-soft p-3 animate-pop-in">
                <IconTile tone="card">{suggested.icon || DEFAULT_GROUP_ICON}</IconTile>
                <p class="min-w-0 flex-1 text-sm">{$t('home.archive.suggest', { name: suggested.name })}</p>
                <Button size="sm" onclick={() => setArchived(suggested!, true)}>{$t('home.archive.action')}</Button>
                <button
                    type="button"
                    onclick={() => dismissSuggestion(suggested!.id)}
                    class="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-primary/10"
                    aria-label={$t('common.close')}
                >
                    <X class="h-4 w-4" />
                </button>
            </div>
        {/if}

        {#if activeGroups.length > 0}
            <ListGroup>
                {#each activeGroups as k (k.id)}
                    {@render groupRow(k, false)}
                {/each}
            </ListGroup>
            {#if showSwipeHint}
                <p class="px-1 text-xs text-muted-foreground md:hidden">{$t('home.group.swipe_hint')}</p>
            {/if}
        {:else}
            <p class="rounded-card border bg-card px-4 py-3 text-sm text-muted-foreground">{$t('home.archive.all_archived')}</p>
        {/if}

        {#if archivedGroups.length > 0}
            <div class="space-y-2">
                <button
                    type="button"
                    onclick={() => isArchiveOpen = !isArchiveOpen}
                    aria-expanded={isArchiveOpen}
                    class="flex min-h-9 items-center gap-1.5 px-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronDown class="h-4 w-4 transition-transform {isArchiveOpen ? 'rotate-180' : ''}" />
                    {$t('home.archive.title', { count: String(archivedGroups.length) })}
                </button>
                {#if isArchiveOpen}
                    <div transition:slide={{ duration: 150 }}>
                        <ListGroup>
                            {#each archivedGroups as k (k.id)}
                                {@render groupRow(k, true)}
                            {/each}
                        </ListGroup>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</section>
{/if}
