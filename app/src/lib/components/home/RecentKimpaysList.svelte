<script lang="ts">
    import { LogOut, ChevronRight } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { recentsStore } from '#lib/stores/recents.svelte.js';
    import { storageService } from '#lib/services/storage.js';
    import { kimpayService } from '#lib/services/kimpay.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import { auth } from '#lib/stores/auth.svelte.js';
    import EmptyState from '#lib/components/ui/EmptyState.svelte';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
    import SwipeableItem from '#lib/components/ui/SwipeableItem.svelte';
    import Badge from '#lib/components/ui/Badge.svelte';
    import { haptic } from '#lib/utils/haptic.js';
    import { relativeDay } from '#lib/utils/date.js';
    import { DEFAULT_GROUP_ICON } from '#lib/constants.js';
    import { pb } from '#lib/pocketbase.js';
    import type { Expense, Kimpay } from '#lib/types.js';

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
        /** Expenses added by others since my last visit on this device */
        news: number;
        /** Creation date of the latest expense, null without any */
        lastActivity: string | null;
    }

    type ExpenseStamp = Pick<Expense, 'id' | 'created' | 'created_by'>;

    function latest(expenses: ExpenseStamp[]): string | null {
        return expenses.reduce<string | null>((max, e) => (!max || e.created > max ? e.created : max), null);
    }

    /** The group's expenses on the server, reduced to what tells them apart. */
    async function fetchStamps(id: string): Promise<ExpenseStamp[] | null> {
        try {
            const record = await pb.collection('kimpays').getOne(id, {
                expand: 'expenses_via_kimpay',
                fields: 'id,expand.expenses_via_kimpay.id,expand.expenses_via_kimpay.created,expand.expenses_via_kimpay.created_by',
                requestKey: null,
            });
            return (record.expand?.expenses_via_kimpay as ExpenseStamp[] | undefined) ?? [];
        } catch {
            return null;
        }
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
            const cached = (await Promise.all(ids.map(id => storageService.getKimpayData(id))))
                .filter((data) => !!data?.expand) as Kimpay[];
            if (cancelled) return;
            // The cached copy first (instant), then what changed since.
            summaries = Object.fromEntries(cached.map((data) => [data.id, {
                members: data.expand!.participants_via_kimpay?.length ?? 0,
                news: 0,
                lastActivity: latest(data.expand!.expenses_via_kimpay ?? []),
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
                            toasts.error($t('error.generic'));
                            return;
                        }
                    }
                    await recentsStore.forget(id);
                } catch (e) {
                    console.error("Error leaving kimpay", e);
                    toasts.error($t('error.generic'));
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
