<script lang="ts">
  import { Check, Menu, WifiOff, LayoutDashboard } from "@lucide/svelte";
  import Logo from "#lib/components/ui/Logo.svelte";
  import { t } from '#lib/i18n.js';
  import { slide } from 'svelte/transition';
  import { activeKimpayGlobal } from '#lib/stores/activeKimpayGlobal.svelte.js';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import IconTile from '#lib/components/ui/IconTile.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListRow from '#lib/components/ui/ListRow.svelte';
  import Modal from '#lib/components/ui/modals/Modal.svelte';
  import ProfilePanel from '#lib/components/profile/ProfilePanel.svelte';
  import { profileMenu } from '#lib/stores/profileMenu.svelte.js';

  import LoginHelpModal from '#lib/components/ui/modals/LoginHelpModal.svelte';
  import OfflineHelpModal from '#lib/components/ui/modals/OfflineHelpModal.svelte';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { afterNavigate } from '$app/navigation';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { page } from '$app/state';
  import { haptic } from '#lib/utils/haptic.js';
  import { dismissable } from '#lib/attachments/dismissable.js';
  import { DEFAULT_GROUP_ICON } from '#lib/constants.js';

  let isSwitcherOpen = $state(false);
  let showOfflineHelp = $state(false);
  let isLoginHelpOpen = $state(false);

  // Only show Kimpay context if we are actually on a /k/[id] route
  let isInKimpayContext = $derived(page.url.pathname.startsWith('/k/'));
  let currentParticipant = $derived(isInKimpayContext ? activeKimpayGlobal.myParticipant : null);
  let currentKimpay = $derived(isInKimpayContext ? activeKimpayGlobal.kimpay : null);

  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;

    profileMenu.close();
    isSwitcherOpen = false;
  });

  // Phones get bottom sheets, larger screens popovers under the trigger.
  let isDesktop = $state(false);
  $effect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    isDesktop = query.matches;
    const onChange = (e: MediaQueryListEvent) => (isDesktop = e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  });
</script>

{#snippet groupSwitcher(currentId: string)}
  <div class="space-y-3">
    <ListGroup>
      {#each recentsStore.recentKimpays as k (k.id)}
        {@const isCurrent = k.id === currentId}
        <a
          href="/k/{k.id}"
          data-sveltekit-preload-data="false"
          onclick={() => { haptic('light'); isSwitcherOpen = false; }}
          aria-current={isCurrent ? 'page' : undefined}
          class="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors duration-150 first:rounded-t-[inherit] last:rounded-b-[inherit] hover:bg-muted/60 {isCurrent ? 'bg-muted/60' : ''}"
        >
          <IconTile size="sm">{k.icon || DEFAULT_GROUP_ICON}</IconTile>
          <span class="flex-1 truncate text-base font-medium">{k.name}</span>
          {#if isCurrent}<Check class="h-4 w-4 shrink-0 text-primary" />{/if}
        </a>
      {/each}
    </ListGroup>
    <ListGroup>
      <ListRow icon={LayoutDashboard} title={$t('my_kimpays.title')} href="/" />
    </ListGroup>
  </div>
{/snippet}

<header
  class="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-md"
  style="margin-right: calc(100% - 100vw); padding-right: calc(100vw - 100%);"
>
  <div class="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
    {#if currentKimpay}
      <!-- Inside a group: the logo leads home, the title switches groups.
           No back chevron: the group's pages are tabs, not a history. -->
      <a
        href="/"
        onclick={() => haptic('light')}
        class="-ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-control transition-colors hover:bg-muted"
        aria-label={$t('my_kimpays.title')}
        title={$t('my_kimpays.title')}
      >
        <Logo class="h-8 w-8 text-primary" />
      </a>
      <div class="relative min-w-0 flex-1" {@attach isSwitcherOpen && isDesktop && dismissable(() => (isSwitcherOpen = false))}>
        <button
          onclick={() => isSwitcherOpen = !isSwitcherOpen}
          class="-ml-1 flex h-11 max-w-full items-center rounded-control px-2 transition-colors hover:bg-muted"
          aria-haspopup="dialog"
          aria-expanded={isSwitcherOpen}
          title={$t('header.switch_group')}
        >
          <span class="truncate text-base font-bold">
            <span aria-hidden="true">{currentKimpay.icon || DEFAULT_GROUP_ICON}</span>
            {currentKimpay.name}
          </span>
        </button>

        {#if isSwitcherOpen && isDesktop}
          <div
            class="absolute left-0 top-full mt-2 max-h-[calc(100dvh-5rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card border bg-popover p-3 text-popover-foreground shadow-xl"
            transition:slide={{ duration: 150 }}
          >
            {@render groupSwitcher(currentKimpay.id)}
          </div>
        {/if}
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

    <div class="relative shrink-0" {@attach profileMenu.isOpen && isDesktop && dismissable(() => profileMenu.close())}>
      <button
        onclick={() => profileMenu.toggle()}
        class="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted"
        title={$t('nav.menu')}
        aria-label={$t('nav.menu')}
        aria-haspopup="dialog"
        aria-expanded={profileMenu.isOpen}
      >
        {#if currentKimpay}
          <Avatar name={currentParticipant ? currentParticipant.name : "?"} record={currentParticipant} class="h-9 w-9 text-xs" />
        {:else if auth.user}
          <Avatar name={auth.user.name} record={auth.user} class="h-9 w-9 text-xs" />
        {:else}
          <Menu class="h-6 w-6" />
        {/if}
      </button>

      {#if profileMenu.isOpen && isDesktop}
        <div
          class="absolute right-0 top-full mt-2 max-h-[calc(100dvh-5rem)] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card border bg-popover p-3 text-popover-foreground shadow-xl"
          transition:slide={{ duration: 150 }}
        >
          <ProfilePanel onClose={() => profileMenu.close()} onLoginHelp={() => isLoginHelpOpen = true} />
        </div>
      {/if}
    </div>
  </div>
</header>

<!-- On phones, both menus slide up from the bottom (easier to reach). -->
{#if currentKimpay}
  <Modal isOpen={isSwitcherOpen && !isDesktop} onClose={() => isSwitcherOpen = false} variant="sheet" label={$t('header.switch_group')} class="space-y-0 bg-background">
    {@render groupSwitcher(currentKimpay.id)}
  </Modal>
{/if}
<Modal isOpen={profileMenu.isOpen && !isDesktop} onClose={() => profileMenu.close()} variant="sheet" label={$t('profile.title')} class="space-y-0 bg-background">
  <ProfilePanel onClose={() => profileMenu.close()} onLoginHelp={() => isLoginHelpOpen = true} />
</Modal>

<OfflineHelpModal isOpen={showOfflineHelp} onClose={() => showOfflineHelp = false} />
<LoginHelpModal isOpen={isLoginHelpOpen} onClose={() => isLoginHelpOpen = false} />
