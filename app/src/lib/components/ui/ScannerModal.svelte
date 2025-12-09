<script lang="ts">
  import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
  import { onDestroy } from "svelte";
  import { X, LoaderCircle } from "lucide-svelte";
  import { t } from '$lib/i18n';
  import { fade, scale } from 'svelte/transition';

  let { isOpen = false, onScan, onClose } = $props<{ 
      isOpen: boolean, 
      onScan: (decodedText: string) => void, 
      onClose: () => void 
  }>();

  let scannerId = "reader";
  let html5QrCode: Html5Qrcode | null = null;
  let isScanning = $state(false);
  let errorMsg = $state<string | null>(null);

  $effect(() => {
      if (isOpen && !isScanning) {
          startScanner();
      } else if (!isOpen && isScanning) {
          stopScanner();
      }
  });

  async function startScanner() {
      // Small delay to ensure DOM is ready
      await new Promise(r => setTimeout(r, 100));
      
      try {
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode(scannerId, { 
                formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
                verbose: false
            });
        }
        
        isScanning = true;
        errorMsg = null;

        await html5QrCode.start(
            { facingMode: "environment" }, // Rear camera
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
            },
              (decodedText) => {
                  // Success
                  stopScanner().then(() => {
                        onScan(decodedText);
                  });
              },
              (errorMessage) => {
                  // Scanning... ignore individual frame errors
              }
          );
      } catch (err: any) {
          console.error("Failed to start scanner", err);
          isScanning = false;
          // Handle specific errors
          if (err?.name === 'NotAllowedError') {
              errorMsg = "Camera access denied. Please allow camera permissions.";
          } else if (err?.name === 'NotFoundError') {
              errorMsg = "No camera found on this device.";
          } else if (typeof err === 'string' && (err.includes('Is not defined') || err.includes('Secure Context'))) {
              errorMsg = "Secure context check failed. Use HTTPS."; // Common issue
          } else {
              errorMsg = "Could not start camera.";
          }
      }
  }

  async function stopScanner() {
      if (html5QrCode && isScanning) {
          try {
              await html5QrCode.stop();
              isScanning = false;
          } catch (e) {
              console.warn("Failed to stop scanner", e);
          }
      }
  }

  function handleClose() {
      stopScanner().then(onClose);
  }

  onDestroy(() => {
      stopScanner();
  });
</script>

{#if isOpen}
  <div class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" transition:fade={{ duration: 200 }}>
      
      <div class="w-full max-w-sm bg-black rounded-3xl overflow-hidden relative shadow-2xl border border-white/10" transition:scale={{ start: 0.95 }}>
          <!-- Header -->
          <div class="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
              <h2 class="text-white font-bold text-lg drop-shadow-md">Scan QR Code</h2>
              <button onclick={handleClose} class="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md transition-colors">
                  <X class="h-5 w-5" />
              </button>
          </div>

          <!-- Scanner Area -->
          <div class="relative aspect-[3/4] bg-black">
              <div id={scannerId} class="w-full h-full object-cover"></div>
              
              {#if !isScanning && !errorMsg}
                  <div class="absolute inset-0 flex items-center justify-center text-white/50">
                      <LoaderCircle class="h-8 w-8 animate-spin" />
                  </div>
              {/if}

              {#if errorMsg}
                  <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-red-400 bg-black/80">
                      <p class="font-medium">{errorMsg}</p>
                      <button onclick={handleClose} class="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm">
                          {$t('common.cancel')}
                      </button>
                  </div>
              {/if}

              <!-- Visual Guide Overlay -->
              {#if isScanning}
                 <div class="absolute inset-0 pointer-events-none border-[30px] border-black/50">
                    <div class="absolute inset-0 border-2 border-white/30 rounded-lg">
                        <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl"></div>
                        <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl"></div>
                        <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl"></div>
                        <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-xl"></div>
                    </div>
                 </div>
                 <p class="absolute bottom-6 left-0 right-0 text-center text-white/80 text-sm font-medium drop-shadow-sm px-4">
                     Align text code within frame
                 </p>
              {/if}
          </div>
      </div>
  </div>
{/if}

<style>
  /* Override html5-qrcode styles if needed */
  :global(#reader video) {
      object-fit: cover;
      width: 100% !important;
      height: 100% !important;
      border-radius: 1.5rem;
  }
</style>
