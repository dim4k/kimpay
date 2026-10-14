<script lang="ts">
  import HomeHero from '#lib/components/home/HomeHero.svelte';
  import CreateKimpayForm from '#lib/components/home/CreateKimpayForm.svelte';
  import JoinKimpayForm from '#lib/components/home/JoinKimpayForm.svelte';
  import RecentKimpaysList from '#lib/components/home/RecentKimpaysList.svelte';
  import MagicLinkForm from '#lib/components/auth/MagicLinkForm.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { prefs } from '#lib/utils/prefs.js';
  import { STORAGE_KEYS } from '#lib/constants.js';
  import { Plus, QrCode, CloudOff } from '@lucide/svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { t } from '#lib/i18n.js';

  type Flow = 'create' | 'join';

  // Returning users get their groups first; newcomers get the forms.
  let hasGroups = $derived(auth.isValid || recentsStore.recentKimpays.length > 0);
  // Wait for the local list before choosing (no flash of the newcomer view),
  // then keep that view: creating a group adds it to the list just before
  // leaving the page, which must not swap the form away mid-creation.
  let view = $state<'groups' | 'newcomer' | null>(null);
  $effect(() => {
      if (view !== null) return;
      if (hasGroups) view = 'groups';
      else if (recentsStore.initialized) view = 'newcomer';
  });
  // Logged in from here (magic link) or another tab: the account's groups.
  $effect(() => {
      if (view === 'newcomer' && auth.isValid) view = 'groups';
  });

  // Newcomers: one card, create or join.
  let tab = $state<Flow>('create');
  // No group here, but an account was used on this device: logging back in
  // comes first (creating a group stays one tap away).
  let welcomeBack = $state(!auth.isValid && prefs.get(STORAGE_KEYS.HAD_ACCOUNT) === 'true');
  // Returning users: a new group is the main action; joining is rare (a
  // link or a QR code opens the group by itself).
  let openFlow = $state<Flow | null>(null);

  // The newcomer's form (not the "welcome back" login): the brand's light, two columns on larger screens.
  let isNewcomerForm = $derived(view === 'newcomer' && !(welcomeBack && !offlineStore.isOffline));

  function toggleFlow(flow: Flow) {
      openFlow = openFlow === flow ? null : flow;
  }
</script>

{#snippet offlineNotice()}
    <div class="space-y-2 rounded-card bg-warning-soft p-6 text-center text-warning animate-pop-in">
        <CloudOff class="mx-auto h-10 w-10" />
        <p class="font-semibold">{$t('home.offline.title')}</p>
        <p class="text-sm">{$t('home.offline.desc')}</p>
    </div>
{/snippet}

<!-- Full width, so the brand's light behind the newcomer's form fades out
     at the screen's edges (clipped there, never scrolled to). -->
<div class="w-full {isNewcomerForm ? 'relative isolate overflow-x-clip' : ''}">
{#if isNewcomerForm}
    <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-brand-glow" aria-hidden="true"></div>
{/if}
<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 {isNewcomerForm ? 'md:max-w-4xl md:py-14' : ''}">
    {#if view === null}
        <!-- Reading the groups saved on this device: their place if it takes
             a while, not a blank page (nothing flashes when it is quick). -->
        <div class="animate-pop-in [animation-delay:300ms]">
            <ListSkeleton count={2} />
        </div>
    {:else if view === 'groups'}
        <RecentKimpaysList />

        {#if offlineStore.isOffline}
            {@render offlineNotice()}
        {:else}
            <div class="space-y-1">
                <Button size="lg" class="w-full" onclick={() => toggleFlow('create')} aria-expanded={openFlow === 'create'}>
                    <Plus class="size-5!" />
                    {$t('home.tile.create')}
                </Button>
                <button
                    type="button"
                    onclick={() => toggleFlow('join')}
                    aria-expanded={openFlow === 'join'}
                    class="flex min-h-11 w-full items-center justify-center gap-2 rounded-control text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
                >
                    <QrCode class="h-4 w-4" />
                    {$t('home.join.have_link')}
                </button>
            </div>

            {#if openFlow}
                <div class="rounded-card border bg-card p-4 animate-pop-in">
                    {#if openFlow === 'create'}
                        <CreateKimpayForm />
                    {:else}
                        <JoinKimpayForm />
                    {/if}
                </div>
            {/if}
        {/if}
    {:else if welcomeBack && !offlineStore.isOffline}
        <div class="space-y-5 rounded-card border bg-card p-5 animate-pop-in">
            <div class="space-y-2 text-center">
                <h1 class="text-2xl font-bold tracking-tight text-balance">{$t('home.welcome_back.title')}</h1>
                <p class="mx-auto max-w-sm text-sm text-muted-foreground">{$t('home.welcome_back.desc')}</p>
            </div>
            <MagicLinkForm />
        </div>
        <button
            type="button"
            onclick={() => (welcomeBack = false)}
            class="flex min-h-11 w-full items-center justify-center rounded-control text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
        >
            {$t('home.tile.choose')}
        </button>
    {:else}
        <div class="space-y-5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-start md:gap-12 md:space-y-0">
            <HomeHero />

            {#if offlineStore.isOffline}
                {@render offlineNotice()}
            {:else}
                <div class="space-y-3">
                    <div class="rounded-card border bg-card p-4 animate-pop-in">
                        {#if tab === 'create'}
                            <CreateKimpayForm />
                        {:else}
                            <JoinKimpayForm />
                        {/if}
                    </div>
                    <!-- Joining is rare (a link or a QR code opens the group by itself). -->
                    <button
                        type="button"
                        onclick={() => (tab = tab === 'create' ? 'join' : 'create')}
                        class="flex min-h-11 w-full items-center justify-center gap-2 rounded-control text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
                    >
                        {#if tab === 'create'}
                            <QrCode class="h-4 w-4" />
                            {$t('home.join.have_link')}
                        {:else}
                            <Plus class="h-4 w-4" />
                            {$t('home.tile.create')}
                        {/if}
                    </button>
                    <p class="text-center text-sm text-muted-foreground">
                        {$t('home.recover.have_account')}
                        <button type="button" onclick={() => modals.login()} class="font-semibold text-primary hover:underline">
                            {$t('home.recover.link')}
                        </button>
                    </p>
                </div>
            {/if}
        </div>
    {/if}
</div>
</div>
