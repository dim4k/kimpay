<script lang="ts">
  import HomeHero from '#lib/components/home/HomeHero.svelte';
  import CreateKimpayForm from '#lib/components/home/CreateKimpayForm.svelte';
  import JoinKimpayForm from '#lib/components/home/JoinKimpayForm.svelte';
  import RecentKimpaysList from '#lib/components/home/RecentKimpaysList.svelte';
  import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { Plus, Link, CloudOff } from '@lucide/svelte';
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

  // Newcomers: one card, create or join.
  let tab = $state<Flow>('create');
  // Returning users: a tile opens the flow below it.
  let openFlow = $state<Flow | null>(null);

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

<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
    {#if view === null}
        <!-- Reading the groups saved on this device -->
    {:else if view === 'groups'}
        <RecentKimpaysList />

        {#if offlineStore.isOffline}
            {@render offlineNotice()}
        {:else}
            <div class="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onclick={() => toggleFlow('create')}
                    aria-expanded={openFlow === 'create'}
                    class="flex flex-col items-start gap-2 rounded-card border border-primary bg-primary p-4 text-left text-primary-foreground transition-transform duration-150 active:scale-[0.98] {openFlow === 'create' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}"
                >
                    <Plus class="h-6 w-6" />
                    <span class="text-base font-bold">{$t('home.tile.create')}</span>
                    <span class="text-sm opacity-85">{$t('home.tile.create_desc')}</span>
                </button>
                <button
                    type="button"
                    onclick={() => toggleFlow('join')}
                    aria-expanded={openFlow === 'join'}
                    class="flex flex-col items-start gap-2 rounded-card border bg-card p-4 text-left transition-transform duration-150 active:scale-[0.98] {openFlow === 'join' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}"
                >
                    <Link class="h-6 w-6 text-primary" />
                    <span class="text-base font-bold">{$t('home.tile.join')}</span>
                    <span class="text-sm text-muted-foreground">{$t('home.tile.join_desc')}</span>
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
    {:else}
        <HomeHero />

        {#if offlineStore.isOffline}
            {@render offlineNotice()}
        {:else}
            <div class="space-y-5 rounded-card border bg-card p-4 animate-pop-in">
                <SegmentedControl
                    options={[
                        { value: 'create', label: $t('home.tile.create') },
                        { value: 'join', label: $t('home.tile.join') },
                    ]}
                    bind:value={tab}
                    label={$t('home.tile.choose')}
                />
                {#if tab === 'create'}
                    <CreateKimpayForm />
                {:else}
                    <JoinKimpayForm />
                {/if}
            </div>
        {/if}
    {/if}
</div>
