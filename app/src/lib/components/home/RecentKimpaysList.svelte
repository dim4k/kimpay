<script lang="ts">
    import { LayoutDashboard, LogOut, ArrowRight } from "lucide-svelte";
    import { t } from '$lib/i18n';
    import { offlineStore } from '$lib/stores/offline.svelte';
    import { recentsStore } from '$lib/stores/recents.svelte';
    import ConfirmModal from '$lib/components/ui/modals/ConfirmModal.svelte';
    import { storageService } from '$lib/services/storage';
    import { kimpayService } from '$lib/services/kimpay';
    import { modals } from '$lib/stores/modals.svelte';
    import { auth } from '$lib/stores/auth.svelte';
    import EmptyState from '$lib/components/ui/EmptyState.svelte';
    import { haptic } from '$lib/utils/haptic';

    let kimpaysToDisplay = $derived(
        offlineStore.isOffline 
            ? recentsStore.recentKimpays.filter(k => storageService.hasKimpayData(k.id))
            : recentsStore.recentKimpays
    );

    let kimpayToLeave = $state<string | null>(null);
    let isLeaving = $state(false);

    function requestLeave(id: string, event: Event) {
        event.preventDefault();
        event.stopPropagation();
        kimpayToLeave = id;
    }

    async function confirmLeave() {
        if (!kimpayToLeave) return;
        isLeaving = true;
        try {
            const participantId = await storageService.getMyParticipantId(kimpayToLeave);

            if (participantId) {
                const result = await kimpayService.leave(kimpayToLeave, participantId);
                if (!result.success) {
                    modals.alert({ message: "Error leaving group", title: "Error" });
                    return;
                }
            }
            
            storageService.removeRecentKimpay(kimpayToLeave);
            recentsStore.removeRecentKimpay(kimpayToLeave);
            kimpayToLeave = null;
        } catch (e) {
            console.error("Error leaving kimpay", e);
            modals.alert({ message: "Error leaving group", title: "Error" });
        } finally {
            isLeaving = false;
        }
    }

    function handleLogout() {
        modals.confirm({
            title: $t('modal.logout.title'),
            description: $t('modal.logout.desc'),
            confirmText: $t('modal.logout.confirm'),
            variant: 'destructive',
            onConfirm: () => {
                auth.logout();
                window.location.href = "/";
            }
        });
    }
</script>

<!-- Only show for logged users OR non-logged users with Kimpays -->
{#if auth.user || (!recentsStore.loading && kimpaysToDisplay.length > 0)}
<div class="w-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-1 mb-4">
        <h2 class="font-bold text-2xl flex items-center gap-3">
            <LayoutDashboard class="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            {$t('my_kimpays.title', { default: 'My Kimpays' })}
        </h2>

        {#if auth.user}
            <div class="flex items-center gap-4 text-sm">
                <span class="text-slate-500 dark:text-slate-400 hidden md:inline-block font-medium">{auth.user.email}</span>
                <button 
                    onclick={handleLogout}
                    class="flex items-center gap-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors font-semibold"
                >
                    <LogOut class="h-4 w-4" />
                    <span class="hidden md:inline">{$t('auth.logout')}</span>
                </button>
            </div>
        {/if}
    </div>

    <!-- Content -->
    {#if recentsStore.loading}
        <div class="flex justify-center py-8">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
    {:else if kimpaysToDisplay.length === 0}
        <EmptyState description={$t('my_kimpays.empty', { default: 'No Kimpays joined yet.' })} />
    {:else}
        <div class="grid gap-3">
            {#each kimpaysToDisplay as k (k.id)}
                <a href="/k/{k.id}" data-sveltekit-preload-data="off" onclick={() => haptic('light')} class="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/20 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all duration-300 group">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">{k.icon || "📁"}</span>
                        <span class="font-medium text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">{k.name}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button 
                            class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            onclick={(e) => requestLeave(k.id, e)}
                            title={$t('home.history.leave_tooltip')}
                            aria-label={$t('home.history.leave_tooltip')}
                        >
                            <LogOut class="h-4 w-4" />
                        </button>
                        <ArrowRight class="h-4 w-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                </a>
            {/each}
        </div>
    {/if}
</div>
{/if}

<ConfirmModal 
    isOpen={!!kimpayToLeave}
    title={$t('modal.leave.title')}
    description={$t('modal.leave.desc')}
    confirmText={$t('modal.leave.confirm')}
    variant="destructive"
    isProcessing={isLeaving}
    onConfirm={confirmLeave}
    onCancel={() => kimpayToLeave = null}
/>
