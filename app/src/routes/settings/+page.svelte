<script lang="ts">
    import { goto } from '$app/navigation';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { t, locale } from '#lib/i18n.js';
    import { CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY, getCurrencyName } from '#lib/services/currency.js';
    import { userService } from '#lib/services/user.js';
    import { ArrowLeft, ChevronDown, Check, Pencil, Loader2, Camera, Trash2 } from '@lucide/svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
    import { slide } from 'svelte/transition';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { getErrorMessage } from '#lib/utils/errors.js';

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
            auth.setUser(updated);
        } catch (e) {
            console.error('Failed to save currency preference', e);
            toasts.error(getErrorMessage(e, $t));
        } finally {
            isSaving = false;
        }
    }

    async function saveName() {
        if (!userName.trim() || !auth.user) return;
        
        isSavingName = true;
        try {
            const updated = await userService.updatePreferences(auth.user.id, { name: userName.trim() });
            auth.setUser(updated);
            isEditingName = false;
        } catch (e) {
            console.error('Failed to save name', e);
            toasts.error(getErrorMessage(e, $t));
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
            auth.setUser(updated);
        } catch (err) {
            console.error('Failed to update avatar', err);
            toasts.error(getErrorMessage(err, $t));
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
            auth.setUser(updated);
        } catch (err) {
            console.error('Failed to remove avatar', err);
            toasts.error(getErrorMessage(err, $t));
        } finally {
            isSavingAvatar = false;
        }
    }
</script>

<svelte:head>
    <title>{$t('user_settings.title')} - Kimpay</title>
</svelte:head>

<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-4">
    <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" class="-ml-2 text-muted-foreground" onclick={goBack} aria-label={$t('common.back')}>
            <ArrowLeft class="size-5!" />
        </Button>
        <h1 class="text-xl font-bold">{$t('user_settings.title')}</h1>
    </div>

    {#if auth.user}
        <!-- Profile -->
        <section class="space-y-2">
            <SectionLabel title={$t('user_settings.account.title')} />
            <div class="divide-y rounded-card border bg-card">
                <div class="flex items-center gap-4 p-4">
                    <div class="group relative shrink-0">
                        <Avatar name={auth.user.name || auth.user.email} record={auth.user} class="h-16 w-16 text-xl" />
                        {#if isSavingAvatar}
                            <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                                <Loader2 class="h-6 w-6 animate-spin text-white" />
                            </div>
                        {/if}
                        <input type="file" accept="image/*" class="hidden" bind:this={fileInputRef} onchange={handleAvatarChange} />
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onclick={() => fileInputRef?.click()} disabled={isSavingAvatar}>
                            <Camera />
                            {$t('user_settings.avatar.change')}
                        </Button>
                        {#if auth.user.avatar}
                            <Button variant="ghost-destructive" size="sm" onclick={confirmRemoveAvatar} disabled={isSavingAvatar}>
                                <Trash2 />
                                {$t('user_settings.avatar.remove')}
                            </Button>
                        {/if}
                    </div>
                </div>

                <div class="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                    <span class="text-sm text-muted-foreground">{$t('user_settings.account.email')}</span>
                    <span class="truncate font-medium">{auth.user.email}</span>
                </div>

                {#if isEditingName}
                    <div class="space-y-3 px-4 py-3" transition:slide={{ duration: 150 }}>
                        <label for="account-name" class="block text-sm text-muted-foreground">{$t('user_settings.account.name')}</label>
                        <Input id="account-name" bind:value={userName} placeholder={$t('user_settings.account.name_placeholder')} />
                        <div class="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onclick={() => isEditingName = false}>{$t('common.cancel')}</Button>
                            <Button size="sm" onclick={saveName} disabled={isSavingName || !userName.trim()}>
                                {#if isSavingName}<Loader2 class="animate-spin" />{:else}<Check />{/if}
                                {$t('common.save')}
                            </Button>
                        </div>
                    </div>
                {:else}
                    <button
                        type="button"
                        onclick={() => { isEditingName = true; userName = auth.user?.name ?? ''; }}
                        class="flex w-full min-h-14 items-center justify-between gap-3 rounded-b-[inherit] px-4 py-3 text-left transition-colors hover:bg-muted/60"
                    >
                        <span class="text-sm text-muted-foreground">{$t('user_settings.account.name')}</span>
                        <span class="flex min-w-0 items-center gap-2">
                            <span class="truncate font-medium">{auth.user.name || '-'}</span>
                            <Pencil class="h-4 w-4 shrink-0 text-muted-foreground" />
                        </span>
                    </button>
                {/if}
            </div>
        </section>
    {/if}

    <!-- Currency Preference -->
    <section class="space-y-2">
        <SectionLabel title={$t('user_settings.currency.title')} />
        <div class="rounded-card border bg-card">
            <button
                type="button"
                onclick={() => isCurrencyOpen = !isCurrencyOpen}
                aria-expanded={isCurrencyOpen}
                class="flex w-full min-h-14 items-center gap-3 rounded-[inherit] px-4 py-3 text-left transition-colors hover:bg-muted/60"
            >
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base">{CURRENCIES[selectedCurrency]?.symbol}</span>
                <span class="flex min-w-0 flex-1 flex-col">
                    <span class="font-medium">{selectedCurrency}</span>
                    <span class="truncate text-sm text-muted-foreground">{getCurrencyName(selectedCurrency, $locale)}</span>
                </span>
                <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform {isCurrencyOpen ? 'rotate-180' : ''}" />
            </button>

            {#if isCurrencyOpen}
                <div class="divide-y border-t" transition:slide={{ duration: 150 }}>
                    {#each CURRENCY_CODES as code (code)}
                        <button
                            type="button"
                            onclick={() => saveCurrency(code)}
                            disabled={isSaving}
                            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors last:rounded-b-[inherit] hover:bg-muted/60 {selectedCurrency === code ? 'bg-primary-soft' : ''}"
                        >
                            <span class="w-8 text-center text-base">{CURRENCIES[code]?.symbol}</span>
                            <span class="flex min-w-0 flex-1 flex-col">
                                <span class="font-medium">{code}</span>
                                <span class="truncate text-sm text-muted-foreground">{getCurrencyName(code, $locale)}</span>
                            </span>
                            {#if selectedCurrency === code}
                                <Check class="h-5 w-5 text-primary" />
                            {/if}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        <p class="px-1 text-sm text-muted-foreground">{$t('user_settings.currency.desc')}</p>
    </section>
</div>
