<script lang="ts">
  import { page } from '$app/state';
  import { ChartPie, Plus, Settings, Users, Wallet } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';

  import { ActiveKimpay, setActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { activeKimpayGlobal } from '#lib/stores/activeKimpayGlobal.svelte.js';
  
  import { modals } from '#lib/stores/modals.svelte.js';
  import NavItem from '#lib/components/ui/NavItem.svelte';
  import { haptic } from '#lib/utils/haptic.js';
  import { installStore } from '#lib/stores/install.svelte.js';
  import { profileStore } from '#lib/stores/profile.svelte.js';
  import { setRequestActor } from '#lib/pocketbase.js';
  
  import { onDestroy, type Snippet } from 'svelte';
  
  let { children }: { children: Snippet } = $props();
  
  // Initialize ActiveKimpay
  let activeKimpay = $state<ActiveKimpay>();
  
  // Only recreate when ID changes, NOT on every navigation within the Kimpay
  $effect(() => {
      const id = page.params.id;
      if (activeKimpay?.id !== id) {
          activeKimpay?.destroy();
          modals.closeIdentity();
          if (id) {
              activeKimpay = new ActiveKimpay(id);
              // Expose the instance to the root-layout navbar (SiteHeader).
              activeKimpayGlobal.setInstance(activeKimpay);
          }
      }
      // NOTE: No cleanup here! Cleanup in onDestroy only.
  });
  
  // Cleanup only when truly leaving the Kimpay context (component unmount)
  // The group's history says who made each change.
  $effect(() => {
      setRequestActor(activeKimpay?.myParticipantId ?? null);
  });

  onDestroy(() => {
      setRequestActor(null);
      activeKimpay?.destroy();
      activeKimpayGlobal.reset();
      modals.closeIdentity();
  });

  // Provide context
  setActiveKimpayContext({ get value() { return activeKimpay!; } });

  // Derived values
  let kimpayId = $derived(activeKimpay?.id ?? page.params.id ?? '');

  // A group of one: inviting the others is the next step.
  let isAlone = $derived(!!activeKimpay && !activeKimpay.loading && activeKimpay.participants.length <= 1);

  // Expense forms are full-screen: no tab bar (they have their own save bar).
  let isFormRoute = $derived(/\/(add|edit)(\/|$)/.test(page.url.pathname));
  
  // Ask "who are you?" once the Kimpay is loaded and this device has no
  // identity in it (never chosen, or the participant was deleted).
  $effect(() => {
      if (!activeKimpay || activeKimpay.loading || !activeKimpay.kimpay) return;
      const myId = activeKimpay.myParticipantId;
      const hasIdentity = !!myId && activeKimpay.participants.some((p) => p.id === myId);
      if (!hasIdentity && !modals.identityState) {
          modals.identity({ kimpayId: activeKimpay.id });
      }
  });

  // Payment handles used to be entered per group: the first ones found
  // become the profile's (they stay shown in that group).
  $effect(() => {
      if (!activeKimpay || activeKimpay.loading) return;
      profileStore.adopt(activeKimpayGlobal.myParticipant ?? undefined).catch((e) =>
          console.warn("Could not take the payment handles into the profile", e),
      );
  });
</script>

<div class="flex flex-1 flex-col {isFormRoute ? '' : installStore.bannerVisible ? 'pb-48' : 'pb-24'}">
  {@render children()}
</div>

{#if !isFormRoute}
<nav class="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label={$t('nav.menu')}>
    <div class="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
        <NavItem
            href="/k/{kimpayId}"
            icon={Wallet}
            label={$t('nav.expenses')}
            isActive={page.url.pathname.endsWith(kimpayId)}
        />

        <NavItem
            href="/k/{kimpayId}/balance"
            icon={ChartPie}
            label={$t('nav.balance')}
            isActive={page.url.pathname.includes('/balance')}
        />

        <!-- The one primary action of a group: add an expense. -->
        <a
            href="/k/{kimpayId}/add"
            onclick={() => haptic('light')}
            class="-mt-6 flex h-13 w-13 items-center justify-center justify-self-center rounded-card bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            title={$t('expense.add.title')}
            aria-label={$t('expense.add.title')}
        >
            <Plus class="h-6 w-6" strokeWidth={2.5} />
        </a>

        <NavItem
            href="/k/{kimpayId}/members"
            icon={Users}
            label={$t('nav.members')}
            isActive={page.url.pathname.includes('/members')}
            badge={isAlone}
        />

        <NavItem
            href="/k/{kimpayId}/settings"
            icon={Settings}
            label={$t('nav.group')}
            isActive={page.url.pathname.includes('/settings')}
        />
    </div>
</nav>
{/if}
