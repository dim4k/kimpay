<script lang="ts">
    import { pb } from '$lib/pocketbase';
    import { goto } from '$app/navigation';
    import { auth } from '$lib/stores/auth.svelte';
    import { t } from '$lib/i18n';
    import { CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY } from '$lib/services/currency';
    import { userService } from '$lib/services/user';
    import { ArrowLeft, ChevronDown, Check, Pencil, Loader2, Camera, Trash2 } from 'lucide-svelte';
    import { slide } from 'svelte/transition';
    import Avatar from '$lib/components/ui/Avatar.svelte';
    import { modals } from '$lib/stores/modals.svelte';

    let selectedCurrency = $state(auth.user?.preferred_currency ?? DEFAULT_CURRENCY);
    let isCurrencyOpen = $state(false);
    let isSaving = $state(false);

    // Name editing
    let userName = $state(auth.user?.name ?? '');
    let isEditingName = $state(false);
    let isSavingName = $state(false);

    // Avatar management
    let fileInputRef = $state<HTMLInputElement | null>(null);
    let isSavingAvatar = $state(false);

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
            const updated = await userService.updatePreferences(auth.user!.id, { currency: code });
            if (auth.user) {
                auth.user.preferred_currency = updated.preferred_currency ?? code;
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
            const updated = await userService.updatePreferences(auth.user.id, { name: userName.trim() });
            auth.user.name = updated.name;
            isEditingName = false;
        } catch (e) {
            console.error('Failed to save name', e);
        } finally {
            isSavingName = false;
        }
    }

    async function handleAvatarChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files?.[0] || !auth.user) return;
        
        const file = input.files[0];
        isSavingAvatar = true;
        
        try {
            const updated = await userService.updateAvatar(auth.user.id, file);
            auth.user.avatar = updated.avatar ?? '';
        } catch (err) {
            console.error('Failed to update avatar', err);
        } finally {
            isSavingAvatar = false;
            if (fileInputRef) fileInputRef.value = '';
        }
    }

    function confirmRemoveAvatar() {
        modals.confirm({
            title: $t('user_settings.avatar.remove_confirm_title'),
            description: $t('user_settings.avatar.remove_confirm_desc'),
            confirmText: $t('user_settings.avatar.remove'),
            variant: 'destructive',
            onConfirm: removeAvatar
        });
    }

    async function removeAvatar() {
        if (!auth.user) return;
        
        isSavingAvatar = true;
        try {
            const updated = await userService.removeAvatar(auth.user.id);
            auth.user.avatar = updated.avatar ?? '';
        } catch (err) {
            console.error('Failed to remove avatar', err);
        } finally {
            isSavingAvatar = false;
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

        <!-- Profile Picture -->
        {#if auth.user}
            <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div class="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 class="font-semibold text-slate-900 dark:text-slate-100">{$t('user_settings.avatar.title')}</h2>
                </div>
                <div class="p-4">
                    <div class="flex items-center gap-4">
                        <!-- Avatar with camera overlay -->
                        <div class="relative group">
                            <Avatar 
                                name={auth.user.name || auth.user.email} 
                                src={auth.user.avatar ? pb.files.getURL(auth.user, auth.user.avatar) : null}
                                class="w-20 h-20 text-2xl"
                            />
                            {#if isSavingAvatar}
                                <div class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                    <Loader2 class="h-6 w-6 text-white animate-spin" />
                                </div>
                            {:else}
                                <button 
                                    class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    onclick={() => fileInputRef?.click()}
                                >
                                    <Camera class="h-6 w-6 text-white" />
                                </button>
                            {/if}
                            <input 
                                type="file" 
                                accept="image/*"
                                class="hidden" 
                                bind:this={fileInputRef}
                                onchange={handleAvatarChange}
                            />
                        </div>
                        
                        <!-- Buttons -->
                        <div class="flex flex-col gap-2">
                            <button
                                onclick={() => fileInputRef?.click()}
                                disabled={isSavingAvatar}
                                class="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                <Camera class="h-4 w-4" />
                                {$t('user_settings.avatar.change')}
                            </button>
                            {#if auth.user.avatar}
                                <button
                                    onclick={confirmRemoveAvatar}
                                    disabled={isSavingAvatar}
                                    class="flex items-center gap-2 px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    <Trash2 class="h-4 w-4" />
                                    {$t('user_settings.avatar.remove')}
                                </button>
                            {/if}
                        </div>
                    </div>
                </div>
            </section>
        {/if}

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

