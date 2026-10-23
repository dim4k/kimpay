<script lang="ts">
  import { page } from '$app/state';
  import { afterNavigate, goto, replaceState } from '$app/navigation';
  import { ChartPie, Keyboard, Plus, ScanLine, SearchX, Settings, Users, Wallet, WifiOff } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';

  import { ActiveKimpay, setActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { activeKimpayGlobal } from '#lib/stores/activeKimpayGlobal.svelte.js';
  
  import { modals } from '#lib/stores/modals.svelte.js';
  import NavItem from '#lib/components/ui/NavItem.svelte';
  import ExpenseSheet from '#lib/components/expense/ExpenseSheet.svelte';
  import { expenseSheet, opensExpenseSheet, showExpenseSheet } from '#lib/expenseSheet.js';
  import { confirmDeleteExpense } from '#lib/components/expense/deleteExpense.js';
  import { pendingReceipt } from '#lib/stores/pendingReceipt.js';
  import { layout } from '#lib/stores/layout.svelte.js';
  import Modal from '#lib/components/ui/modals/Modal.svelte';
  import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';
  import { haptic } from '#lib/utils/haptic.js';
  import { installStore } from '#lib/stores/install.svelte.js';
  import { profileStore } from '#lib/stores/profile.svelte.js';
  import { setRequestActor } from '#lib/pocketbase.js';
  import { auth } from '#lib/stores/auth.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { kimpayService } from '#lib/services/kimpay.js';
  import { recentsStore } from '#lib/stores/recents.svelte.js';
  import { storageService } from '#lib/services/storage.js';
  import { prefs } from '#lib/utils/prefs.js';
  import { STORAGE_KEYS } from '#lib/constants.js';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  
  import { onDestroy, tick, untrack, type Snippet } from 'svelte';
  
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

  // The addresses of the expense form, opened from a link or a reload: they
  // only open the form's sheet over the expense list (no tab bar meanwhile).
  let isFormRoute = $derived(/\/(add|edit)(\/|$)/.test(page.url.pathname));
  
  // Ask "who are you?" once the Kimpay is loaded and this device has no
  // identity in it (never chosen, or the participant was deleted).
  $effect(() => {
      if (!activeKimpay || activeKimpay.loading || !activeKimpay.kimpay) return;
      const myId = activeKimpay.myParticipantId;
      const hasIdentity = !!myId && activeKimpay.participants.some((p) => p.id === myId);
      if (!hasIdentity && !modals.identityState) {
          // Opened from a member's own invite link: their name first.
          const suggestedId = untrack(() => invitedAs);
          modals.identity({ kimpayId: activeKimpay.id, ...(suggestedId && { suggestedId }) });
      }
  });

  // Using the group under a name: shown joined to the others.
  $effect(() => {
      if (!activeKimpay || activeKimpay.loading || modals.identityState) return;
      void activeKimpay.myParticipantId;
      void activeKimpay.participants;
      activeKimpay.markJoined();
  });

  // A member's own invite link ("?as=ID") says who to suggest, once: read
  // on arrival and dropped from the address before anything opens (removed
  // while the dialog closes, Chromium kept the dialog on screen).
  let invitedAs = $state<string | null>(page.url.searchParams.get('as'));
  afterNavigate(() => {
      const as = page.url.searchParams.get('as');
      if (!as) return;
      invitedAs = as;
      const url = new URL(page.url.href);
      url.searchParams.delete('as');
      replaceState(url, page.state);
  });

  // Created on this device as a guest, opened logged in: the account becomes
  // the group's owner (allowed to delete it).
  let groupLoaded = $derived(!!activeKimpay?.kimpay);
  $effect(() => {
      const id = activeKimpay?.id;
      if (!auth.user || !id || !groupLoaded || offlineStore.isOffline) return;
      kimpayService.claimOwnership(id).catch((e) =>
          console.warn("Could not claim the group's ownership", e),
      );
  });

  // A wrong link, a deleted group, or no connection and nothing kept here:
  // said as such, instead of an empty group.
  let unavailable = $derived(activeKimpay && !activeKimpay.kimpay ? activeKimpay.error : null);
  let isRetrying = $state(false);

  async function retry() {
      isRetrying = true;
      try {
          await activeKimpay?.refetch();
      } finally {
          isRetrying = false;
      }
  }

  /** A group that is gone: out of my list, back to it. */
  async function forgetGroup() {
      const id = kimpayId;
      recentsStore.removeRecentKimpay(id);
      await goto('/');
      await storageService.removeRecentKimpay(id);
  }

  // The group opened last: where the app icon's shortcuts lead.
  $effect(() => {
      if (groupLoaded && kimpayId) prefs.set(STORAGE_KEYS.LAST_GROUP, kimpayId);
  });

  // The tabs, in the bar of phones and the rail of computers (with their key).
  let tabs = $derived([
      { href: `/k/${kimpayId}`, icon: Wallet, label: $t('nav.expenses'), isActive: page.url.pathname.endsWith(kimpayId), key: '1', badge: false },
      { href: `/k/${kimpayId}/balance`, icon: ChartPie, label: $t('nav.balance'), isActive: page.url.pathname.includes('/balance'), key: '2', badge: false },
      { href: `/k/${kimpayId}/members`, icon: Users, label: $t('nav.members'), isActive: page.url.pathname.includes('/members'), key: '3', badge: isAlone },
      { href: `/k/${kimpayId}/settings`, icon: Settings, label: $t('nav.settings'), isActive: page.url.pathname.includes('/settings'), key: '4', badge: false },
  ]);

  // Keyboard (computers): N adds, / searches, 1-4 change tabs, the arrows go
  // from one expense to the next, Delete deletes it, ? lists them all. Not
  // while typing, nor under a dialog.
  let isHelpOpen = $state(false);

  /** The expense lines of the page, in their order. */
  function expenseRows(): HTMLElement[] {
      return [...document.querySelectorAll<HTMLElement>('[data-expense] > button')];
  }

  function rowOf(id: string | undefined): HTMLElement | undefined {
      return expenseRows().find((row) => row.parentElement?.dataset.expense === id);
  }

  async function focusSearch() {
      if (!page.url.pathname.endsWith(kimpayId)) await goto(`/k/${kimpayId}`, { replaceState: true });
      await tick();
      document.querySelector<HTMLInputElement>('#expense-search')?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
      if (!layout.wide || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isFormRoute || unavailable) return;
      if (document.querySelector('dialog:modal')) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;

      const tab = /^(?:Digit|Numpad)([1-4])$/.exec(e.code)?.[1];
      if (tab) {
          e.preventDefault();
          goto(tabs[Number(tab) - 1]!.href, { replaceState: true });
          return;
      }

      // The line focused, else the expense open beside the list (when the
      // focus is on nothing in particular).
      const row = target.parentElement?.dataset.expense ? target : null;
      const free = target === document.body || target.getAttribute('role') === 'dialog';
      const openId = expenseSheet.controls?.expenseId;
      switch (e.key) {
          case 'n':
          case 'N':
              e.preventDefault();
              showExpenseSheet(kimpayId, {});
              break;
          case '/':
              e.preventDefault();
              focusSearch();
              break;
          case '?':
              e.preventDefault();
              isHelpOpen = true;
              break;
          case 'ArrowDown':
          case 'ArrowUp': {
              const from = row ?? (free && openId ? rowOf(openId) : undefined);
              if (!from) return;
              const rows = expenseRows();
              const next = rows[rows.indexOf(from) + (e.key === 'ArrowDown' ? 1 : -1)];
              e.preventDefault();
              if (!next) return;
              next.focus();
              next.scrollIntoView({ block: 'nearest' });
              // An expense open: the next one takes its place.
              if (openId) next.click();
              break;
          }
          case 'Delete': {
              const id = row?.parentElement?.dataset.expense;
              if (id && activeKimpay && !offlineStore.isOffline) {
                  e.preventDefault();
                  // A reimbursement is cancelled from its sheet.
                  if (!activeKimpay.expenses.find((x) => x.id === id)?.is_reimbursement) confirmDeleteExpense(activeKimpay, id);
              } else if (free && expenseSheet.controls?.deleteShown) {
                  e.preventDefault();
                  expenseSheet.controls.deleteShown();
              }
              break;
          }
      }
  }

  // A receipt dropped on the window (computers): a new expense, read from it.
  let isDragging = $state(false);

  function hasImage(e: DragEvent): boolean {
      return [...(e.dataTransfer?.items ?? [])].some((item) => item.kind === 'file' && item.type.startsWith('image/'));
  }

  function onDragOver(e: DragEvent) {
      if (!layout.wide || isFormRoute || unavailable || !hasImage(e)) return;
      e.preventDefault();
      isDragging = true;
  }

  function onDrop(e: DragEvent) {
      if (!isDragging) return;
      e.preventDefault();
      isDragging = false;
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      pendingReceipt.set(file);
      showExpenseSheet(kimpayId, {});
  }

  // Payment handles used to be entered per group: the first ones found
  // become the profile's (they stay shown in that group).
  $effect(() => {
      if (!activeKimpay || activeKimpay.loading) return;
      profileStore.adopt(activeKimpayGlobal.myParticipant ?? undefined).catch((e) =>
          console.warn("Could not take the payment handles into the profile", e),
      );
  });
</script>

{#if unavailable}
<div class="mx-auto w-full max-w-2xl px-4 py-10">
  <EmptyState
    title={$t(unavailable === 'not_found' ? 'group.gone.title' : 'group.unreachable.title')}
    description={$t(unavailable === 'not_found' ? 'group.gone.desc' : 'group.unreachable.desc')}
    class="animate-pop-in"
  >
    {#snippet icon()}
      {#if unavailable === 'not_found'}<SearchX class="h-12 w-12" />{:else}<WifiOff class="h-12 w-12" />{/if}
    {/snippet}
    {#snippet action()}
      <div class="flex w-64 max-w-full flex-col gap-2">
        {#if unavailable === 'not_found'}
          <Button variant="outline" onclick={forgetGroup}>{$t('group.gone.forget')}</Button>
        {:else}
          <Button onclick={retry} loading={isRetrying}>{$t('common.retry')}</Button>
        {/if}
        <Button variant="ghost" href="/">{$t('my_kimpays.title')}</Button>
      </div>
    {/snippet}
  </EmptyState>
</div>
{:else}
<!-- Phones: room for the tab bar. Computers: room for the rail, and from lg
     for the panel open beside the page. -->
<div class="flex flex-1 flex-col {isFormRoute ? '' : installStore.bannerVisible ? 'pb-48' : 'pb-24'} {isFormRoute ? '' : installStore.bannerVisible ? 'md:pb-36 md:pl-20' : 'md:pb-10 md:pl-20'} {layout.panels > 0 ? 'lg:pr-[calc(var(--panel-width)-var(--scrollbar-width,0px))]' : ''}">
  {@render children()}
</div>
{/if}

{#if !isFormRoute && !unavailable}
<nav class="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label={$t('nav.menu')}>
    <div class="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
        {#each tabs.slice(0, 2) as tab (tab.key)}
            <NavItem href={tab.href} icon={tab.icon} label={tab.label} isActive={tab.isActive} badge={tab.badge} />
        {/each}

        <!-- The one primary action of a group: add an expense. -->
        <a
            href="/k/{kimpayId}/add"
            onclick={(e) => { haptic('light'); opensExpenseSheet(kimpayId)(e); }}
            class="-mt-6 flex h-13 w-13 items-center justify-center justify-self-center rounded-card bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            title={$t('expense.add.title')}
            aria-label={$t('expense.add.title')}
        >
            <Plus class="h-6 w-6" strokeWidth={2.5} />
        </a>

        {#each tabs.slice(2) as tab (tab.key)}
            <NavItem href={tab.href} icon={tab.icon} label={tab.label} isActive={tab.isActive} badge={tab.badge} />
        {/each}
    </div>
</nav>

<!-- Computers: the same, in a rail on the left (the keys in the tooltips). -->
<nav class="fixed bottom-0 left-0 top-14 z-30 hidden w-20 flex-col items-center gap-1 border-r bg-card py-4 md:flex" aria-label={$t('nav.menu')}>
    <a
        href="/k/{kimpayId}/add"
        onclick={opensExpenseSheet(kimpayId)}
        class="group/add mb-3 flex flex-col items-center gap-1 text-xs font-semibold text-primary"
        title="{$t('expense.add.title')} (N)"
        aria-label={$t('expense.add.title')}
    >
        <span class="flex h-12 w-12 items-center justify-center rounded-card bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-150 group-hover/add:scale-105 group-active/add:scale-95">
            <Plus class="h-6 w-6" strokeWidth={2.5} />
        </span>
        {$t('nav.add')}
    </a>
    {#each tabs as tab (tab.key)}
        <NavItem href={tab.href} icon={tab.icon} label={tab.label} isActive={tab.isActive} badge={tab.badge} variant="rail" shortcut={tab.key} />
    {/each}
    <button
        type="button"
        onclick={() => isHelpOpen = true}
        class="mt-auto flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="{$t('shortcuts.title')} (?)"
        aria-label={$t('shortcuts.title')}
    >
        <Keyboard class="h-5 w-5" />
    </button>
</nav>
{/if}

<svelte:window onkeydown={onKeydown} ondragover={onDragOver} ondrop={onDrop} ondragleave={(e) => { if (!e.relatedTarget) isDragging = false; }} />

{#if isDragging}
    <div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 p-6 backdrop-blur-xs" aria-hidden="true">
        <div class="flex items-center gap-3 rounded-card border-2 border-dashed border-primary bg-card px-6 py-5 text-base font-semibold text-primary shadow-xl">
            <ScanLine class="h-6 w-6" />
            {$t('shortcuts.drop_receipt')}
        </div>
    </div>
{/if}

{#snippet key(label: string)}
    <kbd class="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 bg-card px-1.5 font-sans text-xs font-semibold">{label}</kbd>
{/snippet}

<Modal isOpen={isHelpOpen} onClose={() => isHelpOpen = false} variant="sheet" label={$t('shortcuts.title')}>
    <ModalHeader title={$t('shortcuts.title')} icon={Keyboard} align="start" onClose={() => isHelpOpen = false} />
    <dl class="divide-y">
        {#each [
            { keys: ['N'], label: $t('expense.add.title') },
            { keys: ['/'], label: $t('shortcuts.search') },
            { keys: ['1', '2', '3', '4'], label: tabs.map((tab) => tab.label).join(', ') },
            { keys: ['↑', '↓'], label: $t('shortcuts.move') },
            { keys: [$t('shortcuts.key.enter')], label: $t('shortcuts.open') },
            { keys: [$t('shortcuts.key.delete')], label: $t('shortcuts.delete') },
            { keys: [$t('shortcuts.key.escape')], label: $t('shortcuts.close') },
            { keys: ['Ctrl', $t('shortcuts.key.enter')], label: $t('expense.form.save_and_new') },
            { keys: ['?'], label: $t('shortcuts.help') },
        ] as row (row.label)}
            <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="flex shrink-0 gap-1">{#each row.keys as k (k)}{@render key(k)}{/each}</dt>
                <dd class="text-right text-sm">{row.label}</dd>
            </div>
        {/each}
    </dl>
</Modal>

<ExpenseSheet {kimpayId} />
