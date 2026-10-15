<script lang="ts">
  import { Check, ChevronDown, Menu, WifiOff, LayoutDashboard } from "@lucide/svelte";
  import Logo from "#lib/components/ui/Logo.svelte";
  import { t } from '#lib/i18n.js';
  import { slide } from 'svelte/transition';
  import { activeKimpayGlobal } from '#lib/stores/activeKimpayGlobal.svelte.js';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import { archiveStore } from '#lib/stores/archive.svelte.js';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import IconTile from '#lib/components/ui/IconTile.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListRow from '#lib/components/ui/ListRow.svelte';
  import Modal from '#lib/components/ui/modals/Modal.svelte';
  import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';
  import ProfilePanel from '#lib/components/profile/ProfilePanel.svelte';
  import { profileMenu } from '#lib/stores/profileMenu.svelte.js';

  import OfflineHelpModal from '#lib/components/ui/modals/OfflineHelpModal.svelte';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { afterNavigate } from '$app/navigation';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { page } from '$app/state';
  import { haptic } from '#lib/utils/haptic.js';
  import { DEFAULT_GROUP_ICON } from '#lib/constants.js';
  import type { RecentKimpay } from '#lib/types.js';

  let isSwitcherOpen = $state(false);
  let showOfflineHelp = $state(false);

  // Only show Kimpay context if we are actually on a /k/[id] route
  let isInKimpayContext = $derived(page.url.pathname.startsWith('/k/'));
  let currentParticipant = $derived(isInKimpayContext ? activeKimpayGlobal.myParticipant : null);
  let currentKimpay = $derived(isInKimpayContext ? activeKimpayGlobal.kimpay : null);

  // Archived Kimpays are folded, as on the home page (the current one stays
  // in the list, with its check).
  let switcherKimpays = $derived(recentsStore.recentKimpays.filter(k => !archiveStore.has(k.id) || k.id === currentKimpay?.id));
  let archivedKimpays = $derived(recentsStore.recentKimpays.filter(k => archiveStore.has(k.id) && k.id !== currentKimpay?.id));
  let isArchiveOpen = $state(false);

  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;

    profileMenu.close();
    isSwitcherOpen = false;
    isArchiveOpen = false;
  });
</script>

{#snippet switcherRow(k: RecentKimpay, currentId: string)}
  {@const isCurrent = k.id === currentId}
  <a
    href="/k/{k.id}"
    data-sveltekit-preload-data="false"
    onclick={() => { haptic('light'); isSwitcherOpen = false; }}
    aria-current={isCurrent ? 'page' : undefined}
    class="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors duration-150 first:rounded-t-[inherit] last:rounded-b-[inherit] focus-ring-inset hover:bg-muted/60 {isCurrent ? 'bg-muted/60' : ''}"
  >
    <IconTile size="sm">{k.icon || DEFAULT_GROUP_ICON}</IconTile>
    <span class="flex-1 truncate text-base font-medium">{k.name}</span>
    {#if isCurrent}<Check class="h-4 w-4 shrink-0 text-primary" />{/if}
  </a>
{/snippet}

{#snippet groupSwitcher(currentId: string)}
  <div class="space-y-3">
    <ListGroup>
      {#each switcherKimpays as k (k.id)}
        {@render switcherRow(k, currentId)}
      {/each}
    </ListGroup>
    {#if archivedKimpays.length > 0}
      <div class="space-y-2">
        <button
          type="button"
          onclick={() => isArchiveOpen = !isArchiveOpen}
          aria-expanded={isArchiveOpen}
          class="flex items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown class="h-4 w-4 transition-transform {isArchiveOpen ? 'rotate-180' : ''}" />
          {$t('home.archive.title', { count: String(archivedKimpays.length) })}
        </button>
        {#if isArchiveOpen}
          <div transition:slide={{ duration: 150 }}>
            <ListGroup>
              {#each archivedKimpays as k (k.id)}
                {@render switcherRow(k, currentId)}
              {/each}
            </ListGroup>
          </div>
        {/if}
      </div>
    {/if}
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
      <div class="min-w-0 flex-1">
        <button
          onclick={() => isSwitcherOpen = !isSwitcherOpen}
          class="-ml-1 flex h-11 max-w-full items-center gap-1 rounded-control px-2 transition-colors hover:bg-muted"
          aria-haspopup="dialog"
          aria-expanded={isSwitcherOpen}
          title={$t('header.switch_group')}
        >
          <span class="truncate text-base font-bold">
            <!-- A group just created: its emoji jumps once. -->
            <span aria-hidden="true" class="inline-block {page.state.justCreated ? 'animate-celebrate' : ''}">{currentKimpay.icon || DEFAULT_GROUP_ICON}</span>
            {currentKimpay.name}
          </span>
          <!-- Tells the title opens the other groups. -->
          <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 {isSwitcherOpen ? 'rotate-180' : ''}" />
        </button>
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

    <div class="shrink-0">
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
    </div>
  </div>
</header>

<!-- Sheets like the app's others: from the bottom on phones, centered on larger screens. -->
{#if currentKimpay}
  <Modal isOpen={isSwitcherOpen} onClose={() => isSwitcherOpen = false} variant="sheet" label={$t('header.switch_group')}>
    <ModalHeader title={$t('header.switch_group')} align="start" onClose={() => isSwitcherOpen = false} />
    {@render groupSwitcher(currentKimpay.id)}
  </Modal>
{/if}
<Modal isOpen={profileMenu.isOpen} onClose={() => profileMenu.close()} variant="sheet" label={$t('profile.title')}>
  <ProfilePanel onClose={() => profileMenu.close()} />
</Modal>

<OfflineHelpModal isOpen={showOfflineHelp} onClose={() => showOfflineHelp = false} />
