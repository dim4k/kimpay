<script lang="ts">
    import { pb } from '$lib/pocketbase';
    import { goto } from '$app/navigation';
    import { auth } from '$lib/stores/auth.svelte';
    import { t } from '$lib/i18n';
    import { CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY } from '$lib/services/currency';
    import { ArrowLeft, ChevronDown, Check, Pencil, Loader2 } from 'lucide-svelte';
    import { slide } from 'svelte/transition';

    let selectedCurrency = $state(auth.user?.preferred_currency ?? DEFAULT_CURRENCY);
    let isCurrencyOpen = $state(false);
    let isSaving = $state(false);

    // Name editing
    let userName = $state(auth.user?.name ?? '');
    let isEditingName = $state(false);
    let isSavingName = $state(false);

    // Redirect if not logged in
    $effect(() => {
        if (!auth.isValid) {
            goto('/');
        }
    });

    function goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            goto('/');
        }
    }

    async function saveCurrency(code: string) {
        selectedCurrency = code;
        isCurrencyOpen = false;
        isSaving = true;

        try {
            await pb.collection('users').update(auth.user!.id, {
                preferred_currency: code
            });
            // Update local user object
            if (auth.user) {
                auth.user.preferred_currency = code;
            }
        } catch (e) {
            console.error('Failed to save currency preference', e);
        } finally {
            isSaving = false;
        }
    }

    async function saveName() {
        if (!userName.trim() || !auth.user) return;
        
        isSavingName = true;
        try {
            await pb.collection('users').update(auth.user.id, {
                name: userName.trim()
            });
            auth.user.name = userName.trim();
            isEditingName = false;
        } catch (e) {
            console.error('Failed to save name', e);
        } finally {
            isSavingName = false;
        }
    }
</script>

<svelte:head>
    <title>{$t('user_settings.title')} - Kimpay</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <header class="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div class="container flex items-center gap-4 h-14 px-4">
            <button 
                onclick={goBack}
                class="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <ArrowLeft class="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </button>
            <h1 class="font-bold text-lg text-slate-900 dark:text-slate-100">{$t('user_settings.title')}</h1>
        </div>
    </header>

    <main class="container p-4 space-y-6">
        <!-- Currency Preference -->
        <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div class="p-4 border-b border-slate-100 dark:border-slate-800">
                <h2 class="font-semibold text-slate-900 dark:text-slate-100">{$t('user_settings.currency.title')}</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{$t('user_settings.currency.desc')}</p>
            </div>

            <div class="p-4">
                <button
                    onclick={() => isCurrencyOpen = !isCurrencyOpen}
                    class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <div class="flex items-center gap-3">
                        <span class="text-xl">{CURRENCIES[selectedCurrency]?.symbol}</span>
                        <div class="text-left">
                            <div class="font-medium text-slate-900 dark:text-slate-100">{selectedCurrency}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">{CURRENCIES[selectedCurrency]?.name}</div>
                        </div>
                    </div>
                    <ChevronDown class="h-5 w-5 text-slate-400 transition-transform {isCurrencyOpen ? 'rotate-180' : ''}" />
                </button>

                {#if isCurrencyOpen}
                    <div class="mt-2 space-y-1" transition:slide={{ duration: 150 }}>
                        {#each CURRENCY_CODES as code (code)}
                            <button
                                onclick={() => saveCurrency(code)}
                                disabled={isSaving}
                                class="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors {selectedCurrency === code ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}"
                            >
                                <div class="flex items-center gap-3">
                                    <span class="text-xl w-8 text-center">{CURRENCIES[code]?.symbol}</span>
                                    <div class="text-left">
                                        <div class="font-medium text-slate-900 dark:text-slate-100">{code}</div>
                                        <div class="text-xs text-slate-500 dark:text-slate-400">{CURRENCIES[code]?.name}</div>
                                    </div>
                                </div>
                                {#if selectedCurrency === code}
                                    <Check class="h-5 w-5 text-indigo-500" />
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        </section>

        <!-- User Info -->
        {#if auth.user}
            <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div class="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 class="font-semibold text-slate-900 dark:text-slate-100">{$t('user_settings.account.title')}</h2>
                </div>
                <div class="p-4 space-y-4">
                    <!-- Email (read-only) -->
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-500 dark:text-slate-400">{$t('user_settings.account.email')}</span>
                        <span class="font-medium text-slate-900 dark:text-slate-100">{auth.user.email}</span>
                    </div>

                    <!-- Name (editable) -->
                    {#if isEditingName}
                        <div class="space-y-2">
                            <span class="text-sm text-slate-500 dark:text-slate-400">{$t('user_settings.account.name')}</span>
                            <div class="space-y-2" transition:slide={{ duration: 150 }}>
                                <input
                                    type="text"
                                    bind:value={userName}
                                    class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder={$t('user_settings.account.name_placeholder')}
                                />
                                <div class="flex gap-2 justify-end">
                                    <button
                                        onclick={() => isEditingName = false}
                                        class="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                                    >
                                        {$t('common.cancel')}
                                    </button>
                                    <button
                                        onclick={saveName}
                                        disabled={isSavingName || !userName.trim()}
                                        class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                                    >
                                        {#if isSavingName}
                                            <Loader2 class="h-4 w-4 animate-spin" />
                                        {:else}
                                            <Check class="h-4 w-4" />
                                        {/if}
                                        {$t('common.save')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-slate-500 dark:text-slate-400">{$t('user_settings.account.name')}</span>
                            <button
                                onclick={() => { isEditingName = true; userName = auth.user?.name ?? ''; }}
                                class="flex items-center gap-2 group"
                            >
                                <span class="font-medium text-slate-900 dark:text-slate-100">{auth.user.name || '-'}</span>
                                <Pencil class="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            </button>
                        </div>
                    {/if}
                </div>
            </section>
        {/if}
    </main>
</div>

