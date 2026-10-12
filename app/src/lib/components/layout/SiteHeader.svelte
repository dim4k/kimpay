<script lang="ts">
  import { Languages, ChevronDown, ChevronLeft, Check, Sun, Moon, Menu, Camera, RefreshCw, WifiOff, LogOut, LayoutDashboard, UserPlus, Settings, House } from "@lucide/svelte";
  import type { Component } from 'svelte';
  import type { LucideProps } from '@lucide/svelte';
  import Logo from "#lib/components/ui/Logo.svelte";
  import { locale, t, LOCALE_NAMES } from '#lib/i18n.js';
  import { theme } from '#lib/theme.js';
  import { slide } from 'svelte/transition';
  import { activeKimpayGlobal } from '#lib/stores/activeKimpayGlobal.svelte.js';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import { Button } from '#lib/components/ui/button/index.js';

  import LoginHelpModal from '#lib/components/ui/modals/LoginHelpModal.svelte';
  import OfflineHelpModal from '#lib/components/ui/modals/OfflineHelpModal.svelte';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { afterNavigate } from '$app/navigation';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { page } from '$app/state';
  import { haptic } from '#lib/utils/haptic.js';
  import { dismissable } from '#lib/attachments/dismissable.js';
  import { DEFAULT_GROUP_ICON } from '#lib/constants.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';

  let isMenuOpen = $state(false);
  let isLangOptionsOpen = $state(false);
  let isMyKimpaysOpen = $state(false);
  let showOfflineHelp = $state(false);
  let isLoginHelpOpen = $state(false);

  let fileInputRef = $state<HTMLInputElement | null>(null);

  // Only show Kimpay context if we are actually on a /k/[id] route
  let isInKimpayContext = $derived(page.url.pathname.startsWith('/k/'));
  let currentParticipant = $derived(isInKimpayContext ? activeKimpayGlobal.myParticipant : null);
  let currentKimpay = $derived(isInKimpayContext ? activeKimpayGlobal.kimpay : null);

  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;

    isMenuOpen = false;
  });

  async function handleAvatarChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0] && currentParticipant) {
      const file = input.files[0];
      try {
        // The instance updates its participants list optimistically, which
        // the navbar reflects via the activeKimpayGlobal derived getters.
        await activeKimpayGlobal.instance?.updateMyAvatar(file);
        toasts.success($t('toast.avatar_updated'));
        haptic('light');
      } catch (err) {
        console.error("Failed to update avatar", err);
        toasts.error($t('toast.avatar_update_failed'));
      }
      // Reset file input
      input.value = '';
    }
  }

  function openIdentityModal() {
      if (!currentKimpay) return;
      isMenuOpen = false;
      modals.identity({ kimpayId: currentKimpay.id });
  }
</script>

{#snippet menuItem(Icon: Component<LucideProps>, label: string)}
  <Icon class="h-4 w-4 shrink-0 text-muted-foreground" />
  <span class="flex-1 truncate text-left text-sm font-medium">{label}</span>
{/snippet}

<header
  class="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-md"
  style="margin-right: calc(100% - 100vw); padding-right: calc(100vw - 100%);"
>
  <div class="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
    {#if currentKimpay}
      <!-- Inside a group: the group is the page title, home is one tap back. -->
      <a
        href="/"
        onclick={() => haptic('light')}
        class="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={$t('nav.home')}
        title={$t('nav.home')}
      >
        <ChevronLeft class="h-5 w-5" />
      </a>
      <div class="min-w-0 flex-1">
        <p class="truncate text-base font-bold leading-tight">
          <span aria-hidden="true">{currentKimpay.icon || DEFAULT_GROUP_ICON}</span>
          {currentKimpay.name}
        </p>
        <p class="truncate text-xs text-muted-foreground">
          {currentParticipant ? $t('header.identity', { name: currentParticipant.name }) : $t('identity.title')}
        </p>
      </div>
    {:else}
      <a href="/" onclick={() => haptic('light')} class="flex items-center gap-2">
        <Logo class="h-8 w-8 text-primary" />
        <span class="text-xl font-bold tracking-tight text-gradient-brand">Kimpay</span>
      </a>
      <div class="flex-1"></div>
    {/if}

    {#if offlineStore.isOffline}
      <button
        onclick={() => showOfflineHelp = true}
        class="flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-muted px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        title={$t('offline.modal.title')}
      >
        <WifiOff class="h-3.5 w-3.5" />
        {$t('common.offline')}
      </button>
    {/if}

    <div class="relative shrink-0" {@attach isMenuOpen && dismissable(() => (isMenuOpen = false))}>
      <button
        onclick={() => isMenuOpen = !isMenuOpen}
        class="flex h-11 items-center gap-1 rounded-full transition-colors hover:bg-muted {currentKimpay || auth.user ? 'pl-1 pr-2' : 'w-11 justify-center'}"
        title={$t('nav.menu')}
        aria-label={$t('nav.menu')}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
      >
        {#if currentKimpay}
          <Avatar name={currentParticipant ? currentParticipant.name : "?"} record={currentParticipant} class="h-9 w-9 text-xs" />
          <ChevronDown class="h-4 w-4 text-muted-foreground" />
        {:else if auth.user}
          <Avatar name={auth.user.name} record={auth.user} class="h-9 w-9 text-xs" />
          <ChevronDown class="h-4 w-4 text-muted-foreground" />
        {:else}
          <Menu class="h-6 w-6" />
        {/if}
      </button>

      {#if isMenuOpen}
        <div
          class="absolute right-0 top-full mt-2 flex w-72 flex-col overflow-hidden rounded-card border bg-popover text-popover-foreground shadow-xl"
          transition:slide={{ duration: 150 }}
        >
          <div class="max-h-[70vh] overflow-y-auto">
            {#if currentKimpay}
              <!-- Identity in this group -->
              <div class="flex items-center gap-3 border-b p-4">
                <div class="group relative shrink-0">
                  <Avatar name={currentParticipant ? currentParticipant.name : "?"} record={currentParticipant} class="h-12 w-12 text-base" />
                  {#if currentParticipant && !offlineStore.isOffline}
                    <button
                      class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onclick={() => fileInputRef?.click()}
                      aria-label={$t('user_settings.avatar.change')}
                    >
                      <Camera class="h-5 w-5 text-white" />
                    </button>
                    <input type="file" accept="image/*" multiple class="hidden" bind:this={fileInputRef} onchange={handleAvatarChange} />
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{currentParticipant ? currentParticipant.name : $t('identity.title')}</p>
                  <p class="truncate text-xs text-muted-foreground">{currentKimpay.icon || DEFAULT_GROUP_ICON} {currentKimpay.name}</p>
                  {#if !offlineStore.isOffline}
                    <button onclick={openIdentityModal} class="mt-1 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <RefreshCw class="h-3 w-3" />
                      {$t('identity.change')}
                    </button>
                  {/if}
                </div>
              </div>
            {/if}

            {#if !auth.user}
              <div class="flex gap-2 border-b p-3">
                <Button size="sm" class="flex-1" onclick={() => { isMenuOpen = false; modals.register({}); }}>
                  <UserPlus />
                  {$t('register.button')}
                </Button>
                <Button size="sm" variant="secondary" class="flex-1" onclick={() => { isMenuOpen = false; isLoginHelpOpen = true; }}>
                  {$t('login_help.button')}
                </Button>
              </div>
            {/if}

            <!-- My Kimpays -->
            <div class="p-2">
              <button
                onclick={() => isMyKimpaysOpen = !isMyKimpaysOpen}
                class="flex w-full items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-muted"
                aria-expanded={isMyKimpaysOpen}
              >
                {@render menuItem(LayoutDashboard, $t('my_kimpays.title'))}
                <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform {isMyKimpaysOpen ? 'rotate-180' : ''}" />
              </button>

              {#if isMyKimpaysOpen}
                <div class="space-y-0.5 pl-2" transition:slide={{ duration: 150 }}>
                  <a href="/" onclick={() => haptic('light')} class="flex items-center gap-3 rounded-control px-3 py-2 transition-colors hover:bg-muted">
                    {@render menuItem(House, $t('nav.home'))}
                  </a>
                  {#if recentsStore.recentKimpays.length === 0}
                    <p class="px-3 py-2 text-sm text-muted-foreground">{$t('my_kimpays.empty')}</p>
                  {:else}
                    {@const filteredKimpays = recentsStore.recentKimpays.filter((k) => k.id !== currentKimpay?.id)}
                    {#each filteredKimpays as k (k.id)}
                      <a
                        href="/k/{k.id}"
                        data-sveltekit-preload-data="false"
                        onclick={() => haptic('light')}
                        class="flex items-center gap-3 rounded-control px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <span class="w-4 text-center text-base" aria-hidden="true">{k.icon || DEFAULT_GROUP_ICON}</span>
                        <span class="truncate text-sm font-medium">{k.name}</span>
                      </a>
                    {/each}
                    {#if filteredKimpays.length === 0 && currentKimpay}
                      <p class="px-3 py-2 text-sm text-muted-foreground">{$t('my_kimpays.no_other')}</p>
                    {/if}
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          <!-- Preferences -->
          <div class="space-y-0.5 border-t bg-muted/40 p-2">
            <button onclick={theme.toggle} class="flex w-full items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-muted">
              {@render menuItem($theme === 'dark' ? Moon : Sun, $t('menu.theme'))}
              <span class="rounded-md border bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {$theme === 'dark' ? $t('menu.theme.dark') : $t('menu.theme.light')}
              </span>
            </button>

            <button
              onclick={() => isLangOptionsOpen = !isLangOptionsOpen}
              class="flex w-full items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-muted"
              aria-expanded={isLangOptionsOpen}
            >
              {@render menuItem(Languages, $t('menu.language'))}
              <span class="rounded-md border bg-card px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">{$locale}</span>
            </button>
            {#if isLangOptionsOpen}
              <div class="space-y-0.5 pl-2" transition:slide={{ duration: 150 }}>
                {#each Object.entries(LOCALE_NAMES) as [code, name] (code)}
                  <button
                    class="flex w-full items-center justify-between rounded-control px-3 py-2 text-sm font-medium transition-colors hover:bg-muted {$locale === code ? 'text-primary' : ''}"
                    onclick={() => { locale.set(code); isLangOptionsOpen = false; }}
                    aria-pressed={$locale === code}
                    lang={code}
                  >
                    {name}
                    {#if $locale === code}<Check class="h-4 w-4" />{/if}
                  </button>
                {/each}
              </div>
            {/if}

            {#if auth.user}
              <a href="/settings" class="flex w-full items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-muted">
                {@render menuItem(Settings, $t('user_settings.title'))}
              </a>
              <button
                onclick={() => { isMenuOpen = false; auth.confirmLogout(); }}
                class="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut class="h-4 w-4 shrink-0" />
                <span class="flex-1 text-left text-sm font-medium">{$t('auth.logout')}</span>
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

<OfflineHelpModal isOpen={showOfflineHelp} onClose={() => showOfflineHelp = false} />
<LoginHelpModal isOpen={isLoginHelpOpen} onClose={() => isLoginHelpOpen = false} />
