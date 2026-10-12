<script lang="ts">
    import { Bug, Camera, Check, Coins, Download, Eye, Languages, LoaderCircle, LogOut, Pencil, Sun, UserPlus, Wallet } from "@lucide/svelte";
    import { slide } from 'svelte/transition';
    import { page } from '$app/state';
    import { t, locale, LOCALE_NAMES } from '#lib/i18n.js';
    import { theme, type ThemeChoice } from '#lib/theme.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { activeKimpayGlobal } from '#lib/stores/activeKimpayGlobal.svelte.js';
    import { installStore } from '#lib/stores/install.svelte.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { profileStore, hasHandles } from '#lib/stores/profile.svelte.js';
    import { userService } from '#lib/services/user.js';
    import { DEFAULT_CURRENCY } from '#lib/services/currency.js';
    import { DEFAULT_GROUP_ICON, NAME_MAX_LENGTH } from '#lib/constants.js';
    import { getErrorMessage } from '#lib/utils/errors.js';
    import { haptic } from '#lib/utils/haptic.js';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import ListRow from '#lib/components/ui/ListRow.svelte';
    import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
    import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
    import Switch from '#lib/components/ui/Switch.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import PaymentHandlesSheet from './PaymentHandlesSheet.svelte';

    interface Props {
        /** Close the panel (before opening another dialog) */
        onClose: () => void;
        onLoginHelp: () => void;
    }

    let { onClose, onLoginHelp }: Props = $props();

    // Inside a group: who I am there.
    let inGroup = $derived(page.url.pathname.startsWith('/k/'));
    let kimpay = $derived(inGroup ? activeKimpayGlobal.kimpay : null);
    let me = $derived(inGroup ? activeKimpayGlobal.myParticipant : null);

    // With an account, the account is who I am (one name, one photo, shared
    // by the groups I joined); otherwise who I am in this group.
    let name = $derived(auth.user ? auth.user.name || auth.user.email : me?.name ?? $t('profile.guest'));
    let photoRecord = $derived(auth.user ? (auth.user.avatar ? auth.user : me) : me);
    let canChangePhoto = $derived(!offlineStore.isOffline && (!!auth.user || !!me));

    let handlesSummary = $derived(
        [profileStore.handles.paypal && 'PayPal', profileStore.handles.revolut && 'Revolut'].filter(Boolean).join(', ')
    );
    let shownHere = $derived(hasHandles(me));

    let isPaymentOpen = $state(false);
    let showAfterSave = $state(false);
    let isLangOpen = $state(false);
    let isUpdatingShown = $state(false);
    let fileInput = $state<HTMLInputElement | null>(null);

    function openPayment(thenShow = false) {
        showAfterSave = thenShow;
        isPaymentOpen = true;
    }

    async function setShown(show: boolean) {
        // Only an account can show payment links in a group: anyone with the
        // link could change a guest's (see the participants' updateRule).
        if (show && !auth.user) {
            onClose();
            modals.register({ description: $t('profile.payment.needs_account') });
            return;
        }
        if (show && !profileStore.hasHandles) {
            openPayment(true);
            return;
        }
        isUpdatingShown = true;
        try {
            await profileStore.showInActiveGroup(show);
            toasts.success(show ? $t('profile.payment.shown') : $t('profile.payment.hidden'));
        } catch (e) {
            console.error("Failed to update shown payment handles", e);
            toasts.error(getErrorMessage(e, $t));
        } finally {
            isUpdatingShown = false;
        }
    }

    async function afterPaymentSaved() {
        if (showAfterSave && inGroup && me && profileStore.hasHandles) await setShown(true);
        showAfterSave = false;
    }

    function changeIdentity() {
        if (!kimpay) return;
        onClose();
        modals.identity({ kimpayId: kimpay.id });
    }

    let isSavingPhoto = $state(false);

    async function changeAvatar(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        isSavingPhoto = true;
        try {
            // The account photo is copied to the groups' participants by the server.
            if (auth.user) auth.setUser(await userService.updateAvatar(auth.user.id, file));
            else await activeKimpayGlobal.instance?.updateMyAvatar(file);
            toasts.success($t('toast.avatar_updated'));
            haptic('light');
        } catch (err) {
            console.error("Failed to update avatar", err);
            toasts.error($t('toast.avatar_update_failed'));
        } finally {
            isSavingPhoto = false;
        }
    }

    function removeAvatar() {
        modals.confirm({
            title: $t('user_settings.avatar.remove_confirm_title'),
            description: $t('user_settings.avatar.remove_confirm_desc'),
            confirmText: $t('user_settings.avatar.remove'),
            variant: 'destructive',
            onConfirm: async () => {
                if (!auth.user) return;
                auth.setUser(await userService.removeAvatar(auth.user.id));
                isEditingAccount = false;
            },
        });
    }

    // Account name, edited in place
    let isEditingAccount = $state(false);
    let accountName = $state('');
    let isSavingName = $state(false);

    function editAccount() {
        accountName = auth.user?.name ?? '';
        isEditingAccount = true;
    }

    async function saveName() {
        if (!auth.user || !accountName.trim()) return;
        isSavingName = true;
        try {
            auth.setUser(await userService.updatePreferences(auth.user.id, { name: accountName.trim() }));
            isEditingAccount = false;
            toasts.success($t('common.saved'));
        } catch (e) {
            console.error('Failed to save name', e);
            toasts.error(getErrorMessage(e, $t));
        } finally {
            isSavingName = false;
        }
    }

    async function saveCurrency(code: string) {
        if (!auth.user) return;
        try {
            auth.setUser(await userService.updatePreferences(auth.user.id, { currency: code }));
        } catch (e) {
            console.error('Failed to save currency preference', e);
            toasts.error(getErrorMessage(e, $t));
        }
    }

    const themeChoice = theme.choice;
    let themeOptions = $derived<{ value: ThemeChoice; label: string }[]>([
        { value: 'light', label: $t('menu.theme.light') },
        { value: 'system', label: $t('menu.theme.system') },
        { value: 'dark', label: $t('menu.theme.dark') },
    ]);
</script>

<div class="space-y-4">
    <!-- Who I am: the account (one photo, one name), and who I am in this group -->
    <div class="space-y-3 px-1">
        <div class="flex items-center gap-3">
            <div class="group relative shrink-0">
                <Avatar name={name} record={photoRecord} class="h-12 w-12 text-base" />
                {#if canChangePhoto}
                    <button
                        class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 transition-opacity {isSavingPhoto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
                        onclick={() => fileInput?.click()}
                        disabled={isSavingPhoto}
                        aria-label={$t('user_settings.avatar.change')}
                    >
                        {#if isSavingPhoto}
                            <LoaderCircle class="h-5 w-5 animate-spin text-white" />
                        {:else}
                            <Camera class="h-5 w-5 text-white" />
                        {/if}
                    </button>
                    <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={changeAvatar} />
                {/if}
            </div>
            <div class="min-w-0 flex-1">
                <p class="truncate text-base font-bold">{name}</p>
                {#if auth.user}
                    <p class="truncate text-sm text-muted-foreground">{auth.user.email}</p>
                {:else if !kimpay}
                    <p class="truncate text-sm text-muted-foreground">{$t('profile.guest_desc')}</p>
                {/if}
            </div>
            {#if auth.user && !isEditingAccount && !offlineStore.isOffline}
                <Button variant="ghost" size="icon" class="text-muted-foreground" onclick={editAccount} aria-label={$t('profile.edit_account')} title={$t('profile.edit_account')}>
                    <Pencil />
                </Button>
            {/if}
        </div>

        {#if isEditingAccount}
            <div class="space-y-3 rounded-card border bg-card p-3" transition:slide={{ duration: 150 }}>
                <div class="space-y-2">
                    <Label for="account-name">{$t('user_settings.account.name')}</Label>
                    <Input id="account-name" bind:value={accountName} maxlength={NAME_MAX_LENGTH} placeholder={$t('user_settings.account.name_placeholder')} onkeydown={(e) => e.key === 'Enter' && saveName()} />
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    {#if auth.user?.avatar}
                        <Button variant="ghost-destructive" size="sm" onclick={removeAvatar}>{$t('profile.remove_photo')}</Button>
                    {/if}
                    <span class="flex-1"></span>
                    <Button variant="secondary" size="sm" onclick={() => isEditingAccount = false}>{$t('common.cancel')}</Button>
                    <Button size="sm" onclick={saveName} loading={isSavingName} disabled={!accountName.trim()}>{$t('common.save')}</Button>
                </div>
            </div>
        {/if}

        {#if kimpay}
            <div class="flex flex-wrap items-center gap-x-2 rounded-control bg-muted/60 px-3 py-2 text-sm">
                <span class="min-w-0 truncate text-muted-foreground">
                    {me && auth.user
                        ? $t('profile.here_as', { name: me.name, group: `${kimpay.icon || DEFAULT_GROUP_ICON} ${kimpay.name}` })
                        : $t('profile.in_group', { name: `${kimpay.icon || DEFAULT_GROUP_ICON} ${kimpay.name}` })}
                </span>
                {#if !offlineStore.isOffline}
                    <button onclick={changeIdentity} class="ml-auto font-semibold text-primary hover:underline">
                        {me ? $t('profile.not_me') : $t('identity.title')}
                    </button>
                {/if}
            </div>
        {/if}
    </div>

    {#if !auth.user}
        <div class="flex gap-2">
            <Button size="sm" class="flex-1" onclick={() => { onClose(); modals.register({}); }}>
                <UserPlus />
                {$t('register.button')}
            </Button>
            <Button size="sm" variant="secondary" class="flex-1" onclick={() => { onClose(); onLoginHelp(); }}>
                {$t('login_help.button')}
            </Button>
        </div>
    {/if}

    <!-- Me, in all my groups (and here) -->
    <div class="space-y-1.5">
        <ListGroup>
            {#if me && !offlineStore.isOffline}
                <ListRow icon={Eye} title={$t('profile.payment.show_here')} subtitle={profileStore.hasHandles ? handlesSummary : $t('profile.payment.add_first')}>
                    {#snippet trailing()}
                        <Switch checked={shownHere} label={$t('profile.payment.show_here')} onchange={setShown} disabled={isUpdatingShown} />
                    {/snippet}
                </ListRow>
            {/if}
            <ListRow icon={Wallet} title={$t('settings.payment.title')} value={handlesSummary || $t('settings.payment.none')} onclick={() => openPayment()} disabled={offlineStore.isOffline} />
            {#if auth.user}
                <ListRow icon={Coins} title={$t('user_settings.currency.title')}>
                    {#snippet trailing()}
                        <CurrencySelect size="sm" value={auth.user?.preferred_currency || DEFAULT_CURRENCY} onchange={saveCurrency} />
                    {/snippet}
                </ListRow>
            {/if}
        </ListGroup>
        <p class="px-1 text-xs text-muted-foreground">{$t('profile.payment.visibility')}</p>
    </div>

    <!-- This device -->
    <ListGroup>
        <ListRow icon={Sun} title={$t('menu.theme')}>
            {#snippet trailing()}
                <SegmentedControl options={themeOptions} value={$themeChoice} label={$t('menu.theme')} onchange={theme.choose} class="w-48" />
            {/snippet}
        </ListRow>
        <ListRow icon={Languages} title={$t('menu.language')} value={LOCALE_NAMES[$locale] ?? $locale} onclick={() => isLangOpen = !isLangOpen} />
        {#if isLangOpen}
            <div class="space-y-0.5 px-2 pb-2" transition:slide={{ duration: 150 }}>
                {#each Object.entries(LOCALE_NAMES) as [code, label] (code)}
                    <button
                        class="flex w-full items-center justify-between rounded-control px-3 py-2 text-sm font-medium transition-colors hover:bg-muted {$locale === code ? 'text-primary' : ''}"
                        onclick={() => { locale.set(code); isLangOpen = false; }}
                        aria-pressed={$locale === code}
                        lang={code}
                    >
                        {label}
                        {#if $locale === code}<Check class="h-4 w-4" />{/if}
                    </button>
                {/each}
            </div>
        {/if}
        {#if !installStore.isStandalone && (installStore.canInstall || installStore.isIOS)}
            <ListRow icon={Download} title={$t('settings.install.button')} onclick={() => installStore.install()} />
        {/if}
        {#if !offlineStore.isOffline}
            <ListRow icon={Bug} title={$t('settings.bug_report.title')} href="https://github.com/dim4k/kimpay/issues" external />
        {/if}
    </ListGroup>

    {#if auth.user}
        <ListGroup>
            <ListRow icon={LogOut} tone="danger" title={$t('auth.logout')} onclick={() => { onClose(); auth.confirmLogout(); }} />
        </ListGroup>
    {/if}

    <p class="text-center text-xs text-muted-foreground">Kimpay v{__APP_VERSION__}</p>
</div>

<PaymentHandlesSheet isOpen={isPaymentOpen} onClose={() => isPaymentOpen = false} onSaved={afterPaymentSaved} />
