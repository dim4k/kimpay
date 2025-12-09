<script lang="ts">
    import { History, LogOut, ArrowRight } from "lucide-svelte";
    import { t } from '$lib/i18n';
    import { appState } from '$lib/stores/appState.svelte';
    import { fade } from 'svelte/transition';
    import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
    import { pb } from '$lib/pocketbase';

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
            const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
            const participantId = myKimpays[kimpayToLeave];
            const kimpay = appState.recentKimpays.find(k => k.id === kimpayToLeave);

            if (participantId) {
                let canDelete = true;

                // 1. Check if Creator
                if (kimpay && kimpay.created_by === participantId) {
                    canDelete = false;
                }

                // 2. Check if involved in expenses (only if not already blocked)
                if (canDelete) {
                    try {
                        const res = await pb.collection('kimpays').getOne(kimpayToLeave, {
                            expand: 'expenses_via_kimpay'
                        });
                        const allExpenses = res.expand ? (res.expand['expenses_via_kimpay'] || []) : [];
                        const isUsed = allExpenses.some((e: any) => e.payer === participantId || (e.involved && e.involved.includes(participantId)));
                        
                        if (isUsed) {
                            canDelete = false;
                        }
                    } catch (e) {
                        console.warn("Could not check expenses", e);
                        canDelete = false; // Safe fallback
                    }
                }

                if (canDelete) {
                    try {
                        await pb.collection('participants').delete(participantId);
                    } catch(e) {
                        console.warn("Could not delete participant from server (likely constraint)", e);
                    }
                }
            }
            
            delete myKimpays[kimpayToLeave];
            localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));
            localStorage.removeItem(`kimpay_user_${kimpayToLeave}`); // Add cleanup here to prevent re-adding on refresh

            appState.removeRecentKimpay(kimpayToLeave);
            kimpayToLeave = null;

        } catch (e) {
            console.error("Error leaving kimpay", e);
            alert("Error leaving group");
        } finally {
            isLeaving = false;
        }
    }
</script>

{#if !appState.loadingRecentKimpays && appState.recentKimpays.length > 0}
    <div class="w-full pt-8 pb-8" transition:fade>
        <div class="flex items-center py-6">
            <div class="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span class="px-4 text-xs uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
                <History class="h-4 w-4" />
                {$t('home.history.title')}
            </span>
            <div class="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>
        
        <div class="grid gap-3">
            {#each appState.recentKimpays as k (k.id)}
                <a href="/k/{k.id}" data-sveltekit-preload-data="off" class="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/20 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all duration-300 group">
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
