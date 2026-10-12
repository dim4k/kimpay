<script lang="ts">
  import { onMount } from 'svelte';
  import { X, Download } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { t } from '#lib/i18n.js';
  import { installStore } from '#lib/stores/install.svelte.js';
  import Modal from '#lib/components/ui/modals/Modal.svelte';
  import { get, set } from 'idb-keyval';
  import { page } from '$app/state';
  import { Button } from '#lib/components/ui/button/index.js';

  let showPrompt = $state(false);

  // Offered once the app is in use: on the tabs of a group, above the tab
  // bar. Never on the home page (it would cover the onboarding forms) nor on
  // the expense forms (their save bar).
  let onGroupTab = $derived(/^\/k\/[^/]+(\/(balance|share|settings))?\/?$/.test(page.url.pathname));
  let visible = $derived(showPrompt && onGroupTab);

  $effect(() => {
    installStore.bannerVisible = visible;
  });

  onMount(async () => {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', async (e) => {
      // Update UI notify the user they can install the PWA
      // BUT ONLY ON MOBILE
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isDismissed = (await get('kimpay_install_dismissed')) === 'true';

      if (isMobile && !isDismissed && !installStore.isStandalone) {
          // Prevent the mini-infobar from appearing on mobile
          e.preventDefault();
          
          // Stash the event so it can be triggered later.
          installStore.setPrompt(e);
          showPrompt = true;
      }
    });

    // iOS Check on mount
    const isMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isDismissed = (await get('kimpay_install_dismissed')) === 'true';
    if (isMobile && !isDismissed && !installStore.isStandalone && installStore.isIOS) {
        showPrompt = true;
    }
  });

  async function handleInstall() {
    await installStore.install();
    if (!installStore.isIOS) {
        await set('kimpay_install_dismissed', 'true');
        showPrompt = false;
    }
  }

  async function dismiss() {
    await set('kimpay_install_dismissed', 'true');
    showPrompt = false;
    installStore.showIOSInstructions = false;
  }
</script>

{#if visible}
  <div 
    transition:fly={{ y: 50, duration: 500 }}
    class="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-card border bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur-md"
  >
    <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary text-primary-foreground">
             <Download class="h-5 w-5" />
        </div>
        <div class="flex min-w-0 flex-col">
            <span class="text-sm font-bold">{$t('install.prompt.title')}</span>
            <span class="text-xs text-muted-foreground">{$t('install.prompt.desc')}</span>
        </div>
    </div>
    
    <div class="flex items-center gap-2">
        <Button size="sm" onclick={handleInstall}>
            {$t('install.prompt.button')}
        </Button>
        <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground"
            onclick={dismiss}
            aria-label={$t('install.prompt.dismiss')}
        >
            <X class="size-5!" />
        </Button>
    </div>
  </div>
{/if}

<Modal
    isOpen={installStore.showIOSInstructions}
    onClose={() => (installStore.showIOSInstructions = false)}
    class="relative rounded-2xl space-y-0"
    backdropClass="bg-black/60 items-end sm:items-center"
>
    <button
        onclick={() => (installStore.showIOSInstructions = false)}
        class="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={$t('common.close')}
    >
        <X class="h-5 w-5" />
    </button>

    <div class="flex flex-col items-center text-center gap-4">
        <div class="mb-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
             <Download class="h-7 w-7" />
        </div>

        <h3 class="text-lg font-bold">{$t('install.ios.title')}</h3>
        <p class="text-sm text-muted-foreground">
            1. {$t('install.ios.step1')} <strong class="text-primary">{$t('install.ios.share')}</strong> <svg class="inline w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
        </p>
        <p class="text-sm text-muted-foreground">
            2. {$t('install.ios.step2')} <strong class="text-primary">{$t('install.ios.add_to_home')}</strong> <svg class="inline w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
        </p>
    </div>
    <!-- Arrow pointing at the Safari toolbar (bottom of the screen) -->
    <div class="absolute -bottom-10 left-1/2 -translate-x-1/2 w-0 h-0 border-l-10 border-l-transparent border-r-10 border-r-transparent border-t-10 border-t-card sm:hidden"></div>
</Modal>
