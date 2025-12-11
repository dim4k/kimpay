<script lang="ts">
  import { onMount } from 'svelte';
  import { X, Download } from 'lucide-svelte';
  import { fly } from 'svelte/transition';
  import { t } from '$lib/i18n';
  import { installStore } from '$lib/stores/install.svelte';

  let showPrompt = $state(false);

  onMount(() => {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Stash the event so it can be triggered later.
      installStore.setPrompt(e);
      
      // Update UI notify the user they can install the PWA
      // BUT ONLY ON MOBILE
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isDismissed = localStorage.getItem('kimpay_install_dismissed') === 'true';

      if (isMobile && !isDismissed && !installStore.isStandalone) {
          // Prevent the mini-infobar from appearing on mobile
          e.preventDefault();
          showPrompt = true;
      }
    });

    // iOS Check on mount
    const isMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isDismissed = localStorage.getItem('kimpay_install_dismissed') === 'true';
    if (isMobile && !isDismissed && !installStore.isStandalone && installStore.isIOS) {
        showPrompt = true;
    }
  });

  async function handleInstall() {
    await installStore.install();
    if (!installStore.isIOS) {
        localStorage.setItem('kimpay_install_dismissed', 'true');
        showPrompt = false;
    }
  }

  function dismiss() {
    localStorage.setItem('kimpay_install_dismissed', 'true');
    showPrompt = false;
    installStore.showIOSInstructions = false;
  }
</script>

{#if showPrompt}
  <div 
    transition:fly={{ y: 50, duration: 500 }}
    class="fixed bottom-4 left-4 right-4 z-[100] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-900 dark:text-white p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 flex items-center justify-between gap-4 transition-colors"
  >
    <div class="flex items-center gap-3">
        <div class="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200 dark:shadow-none">
             <Download class="h-5 w-5 text-white" />
        </div>
        <div class="flex flex-col">
            <span class="font-bold text-sm">{$t('install.prompt.title')}</span>
            <span class="text-xs text-slate-500 dark:text-slate-300">{$t('install.prompt.desc')}</span>
        </div>
    </div>
    
    <div class="flex items-center gap-2">
        <button 
            onclick={handleInstall}
            class="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-md"
        >
            {$t('install.prompt.button')}
        </button>
        <button 
            onclick={dismiss}
            class="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
        >
            <X class="h-5 w-5" />
        </button>
    </div>
  </div>
{/if}

{#if installStore.showIOSInstructions}
  <!-- iOS Instructions Modal -->
  <div 
    class="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in"
    onclick={() => installStore.showIOSInstructions = false}
     role="button" 
     tabindex="-1" 
     onkeydown={(e) => e.key === 'Escape' && (installStore.showIOSInstructions = false)}
  >
    <div 
        class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 relative shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95"
        onclick={(e) => e.stopPropagation()}
        role="button" 
        tabindex="-1" 
        onkeydown={() => {}}
    >
        <button onclick={() => installStore.showIOSInstructions = false} class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X class="h-5 w-5" />
        </button>

        <div class="flex flex-col items-center text-center gap-4">
            <div class="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200 dark:shadow-none mb-2">
                 <Download class="h-7 w-7 text-white" />
            </div>
            
            <h3 class="text-lg font-bold">Install on iPhone</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
                To install Kimpay on your iPhone, tap the <strong class="text-indigo-600 dark:text-indigo-400">Share</strong> button below and select <strong class="text-indigo-600 dark:text-indigo-400">Add to Home Screen</strong>.
            </p>

            <div class="flex items-center gap-3 w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 mt-2">
                 <div class="bg-white dark:bg-slate-700 p-2 rounded-lg shadow-sm">
                    <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                 </div>
                 <div class="flex-1 h-px bg-slate-300 dark:bg-slate-600"></div>
                 <div class="bg-white dark:bg-slate-700 p-2 rounded-lg shadow-sm">
                    <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                 </div>
            </div>
        </div>
        <div class="absolute -bottom-10 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-white dark:border-t-slate-900"></div>
    </div>
  </div>
{/if}
