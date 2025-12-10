<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  import { Copy, Check, Share2, LoaderCircle } from "lucide-svelte";
  import { t } from '$lib/i18n';
  import QRCode from 'qrcode';
  import { DEFAULT_KIMPAY_EMOJI } from '$lib/constants';
  import { appState } from '$lib/stores/appState.svelte';

  let kimpayId = $derived(page.params.id ?? '');
  let kimpay = $derived(appState.kimpay);
  let inviteLink = $state("");
  let copied = $state(false);
  let qrDataUrl = $state<string | null>(null);

  onMount(async () => {
      inviteLink = window.location.href.replace('/share', ''); // Clean URL
      
      // Init app state (deduplicated internally)
      if (kimpayId) {
          appState.init(kimpayId);
      }
      
      // Generate QR immediately with the link
      try {
           qrDataUrl = await QRCode.toDataURL(inviteLink, {
               width: 300,
               margin: 2,
               color: {
                   dark: '#1e293b', // slate-800
                   light: '#ffffff00' // transparent background
               }
           });
      } catch (err) {
          console.error("QR Generation failed", err);
      }
  });

  async function copyLink() {
      try {
          await navigator.clipboard.writeText(inviteLink);
          copied = true;
          setTimeout(() => copied = false, 2000);
      } catch (err) {
          console.error('Failed to copy', err);
      }
  }

  async function shareNative() {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: `Join ${kimpay?.name || 'Kimpay'}`,
                  text: 'Join my group on Kimpay to split expenses!',
                  url: inviteLink
              });
          } catch (err) {
              console.log('Share canceled', err);
          }
      } else {
          copyLink();
      }
  }
</script>

<div class="p-6 flex flex-col items-center justify-center min-h-[80vh] space-y-8 text-center">
    
    <div class="space-y-2 animate-pop-in" style="animation-delay: 100ms; opacity: 0; animation-fill-mode: forwards;">
        <div class="w-20 h-20 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner border border-slate-100 dark:border-slate-700 transition-colors">
            {kimpay?.icon || DEFAULT_KIMPAY_EMOJI}
        </div>
        <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            {kimpay?.name || $t('common.loading')}
        </h1>
        <p class="text-slate-500 dark:text-slate-400">{$t('share.invite_friends')}</p>
    </div>

    <!-- QR Code Block -->
    <!-- QR Code Block -->
    <div class="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 relative group overflow-hidden animate-slide-up" style="animation-delay: 200ms; opacity: 0; animation-fill-mode: forwards;">
        <div class="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        {#if qrDataUrl}
            <img src={qrDataUrl} alt="QR Code" class="h-48 w-48 mx-auto" />
        {:else}
            <!-- Fallback / Loading -->
             <div class="h-48 w-48 flex items-center justify-center text-slate-300">
                <LoaderCircle class="h-8 w-8 animate-spin" />
             </div>
        {/if}

        <div class="mt-4 text-xs font-mono text-slate-500 break-all max-w-[200px] mx-auto">
            {kimpayId}
        </div>
    </div>

    <div class="flex flex-col gap-3 w-full max-w-xs animate-slide-up" style="animation-delay: 300ms; opacity: 0; animation-fill-mode: forwards;">
        <button 
            class="w-full py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95"
            onclick={shareNative}
        >
            <Share2 class="h-5 w-5" />
            {$t('share.invite_button')}
        </button>
        
        <button 
            class="w-full py-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-95"
            onclick={copyLink}
        >
            {#if copied}
                <Check class="h-5 w-5 text-green-600" />
                <span class="text-green-600">{$t('share.copy_success')}</span>
            {:else}
                <Copy class="h-5 w-5" />
                <span>{$t('share.copy_button')}</span>
            {/if}
        </button>
    </div>
</div>
