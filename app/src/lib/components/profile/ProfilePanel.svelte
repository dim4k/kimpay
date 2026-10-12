<script lang="ts">
    import { Bug, Camera, Check, Coins, Download, Eye, Languages, LogOut, Sun, UserPlus, UserRound, Wallet } from "@lucide/svelte";
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
    import { DEFAULT_GROUP_ICON } from '#lib/constants.js';
    import { getErrorMessage } from '#lib/utils/errors.js';
    import { haptic } from '#lib/utils/haptic.js';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import ListRow from '#lib/components/ui/ListRow.svelte';
    import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
    import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
    import Switch from '#lib/components/ui/Switch.svelte';
    import { Button } from '#lib/components/ui/button/index.js';
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

    let name = $derived(me?.name ?? (auth.user ? auth.user.name || auth.user.email : $t('profile.guest')));
    let subtitle = $derived(kimpay ? '' : auth.user ? auth.user.email : $t('profile.guest_desc'));

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

    async function changeAvatar(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file || !me) return;
        try {
            await activeKimpayGlobal.instance?.updateMyAvatar(file);
            toasts.success($t('toast.avatar_updated'));
            haptic('light');
        } catch (err) {
            console.error("Failed to update avatar", err);
            toasts.error($t('toast.avatar_update_failed'));
        }
        input.value = '';
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
    <!-- Who I am (here) -->
    <div class="flex items-center gap-3 px-1">
        <div class="group relative shrink-0">
            <Avatar name={name} record={me ?? auth.user} class="h-12 w-12 text-base" />
            {#if me && !offlineStore.isOffline}
                <button
                    class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onclick={() => fileInput?.click()}
                    aria-label={$t('user_settings.avatar.change')}
                >
                    <Camera class="h-5 w-5 text-white" />
                </button>
                <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={changeAvatar} />
            {/if}
        </div>
        <div class="min-w-0 flex-1">
            <p class="truncate text-base font-bold">{name}</p>
            {#if kimpay}
                <p class="truncate text-sm text-muted-foreground">
                    {$t('profile.in_group', { name: `${kimpay.icon || DEFAULT_GROUP_ICON} ${kimpay.name}` })}
                </p>
                {#if !offlineStore.isOffline}
                    <button onclick={changeIdentity} class="text-sm font-semibold text-primary hover:underline">
                        {me ? $t('profile.not_me') : $t('identity.title')}
                    </button>
                {/if}
            {:else if subtitle}
                <p class="truncate text-sm text-muted-foreground">{subtitle}</p>
            {/if}
        </div>
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
            <ListRow icon={UserRound} title={$t('user_settings.title')} value={auth.user.email} href="/settings" />
            <ListRow icon={LogOut} tone="danger" title={$t('auth.logout')} onclick={() => { onClose(); auth.confirmLogout(); }} />
        </ListGroup>
    {/if}

    <p class="text-center text-xs text-muted-foreground">Kimpay v{__APP_VERSION__}</p>
</div>

<PaymentHandlesSheet isOpen={isPaymentOpen} onClose={() => isPaymentOpen = false} onSaved={afterPaymentSaved} />
