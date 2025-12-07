<script lang="ts">
  import { onMount } from 'svelte';
  import { X, Download } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { t } from '$lib/i18n';

  let deferredPrompt: any = $state(null);
  let showPrompt = $state(false);

  onMount(() => {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      deferredPrompt = e;
      
      // Update UI notify the user they can install the PWA
      // BUT ONLY ON MOBILE
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
          showPrompt = true;
      }
    });

    // Optionally check if already installed to not show (though event usually handles this)
  });

  async function install() {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, discard it
    deferredPrompt = null;
    showPrompt = false;
  }

  function dismiss() {
    showPrompt = false;
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
            <span class="font-bold text-sm">Installer Kimpay</span>
            <span class="text-xs text-slate-500 dark:text-slate-300">Accès rapide sans navigateur</span>
        </div>
    </div>
    
    <div class="flex items-center gap-2">
        <button 
            onclick={install}
            class="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-md"
        >
            Installer
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
