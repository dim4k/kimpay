<script lang="ts">
    import { auth } from '$lib/stores/auth.svelte';
    import { t } from '$lib/i18n';
    import { LoaderCircle, LayoutDashboard, LogOut } from 'lucide-svelte';
    import { onMount } from 'svelte';
    import { modals } from '$lib/stores/modals.svelte';
    import { myKimpays } from '$lib/stores/myKimpays.svelte';

    import EmptyState from '$lib/components/ui/EmptyState.svelte';

    onMount(() => {
        myKimpays.load();
    });
</script>

<div class="space-y-3">
    <div class="flex items-center justify-between px-1 mb-4">
        <h2 class="font-bold text-2xl flex items-center gap-3">
            <LayoutDashboard class="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            {$t('my_kimpays.title', { default: 'My Kimpays' })}
        </h2>

        {#if auth.user}
            <div class="flex items-center gap-4 text-sm">
                <span class="text-slate-500 dark:text-slate-400 hidden md:inline-block font-medium">{auth.user.email}</span>
                <button 
                    onclick={() => {
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
                    }}
                    class="flex items-center gap-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors font-semibold"
                >
                    <LogOut class="h-4 w-4" />
                    <span class="hidden md:inline">{$t('auth.logout')}</span>
                </button>
            </div>
        {/if}
    </div>

    {#if myKimpays.isLoading}
        <div class="flex justify-center py-8">
            <LoaderCircle class="h-6 w-6 animate-spin text-primary" />
        </div>
    {:else if myKimpays.items.length === 0}
        <EmptyState description={$t('my_kimpays.empty', { default: 'No Kimpays joined yet.' })} />
    {:else}
        <div class="grid gap-3">
            {#each myKimpays.items as p (p.id)}
                {#if p.expand?.kimpay}
                    <a href="/k/{p.expand.kimpay.id}" data-sveltekit-preload-data="off" class="flex items-center gap-4 p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-md hover:border-primary/20 group">
                        <div class="text-2xl shrink-0">
                            {p.expand.kimpay.icon || "📁"}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-semibold text-base truncate group-hover:text-primary">{p.expand.kimpay.name}</h3>
                            <div class="flex items-center gap-2 text-xs text-muted-foreground">
                                <span class="truncate">{p.name}</span>
                                <span>•</span>
                                <span>{new Date(p.created).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </a>
                {/if}
            {/each}
        </div>
    {/if}
</div>
