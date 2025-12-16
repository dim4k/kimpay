<script lang="ts">
  import { ChevronLeft, ChevronRight, X } from "lucide-svelte";
  import { fade } from 'svelte/transition';
  import { pb } from '$lib/pocketbase';
  import type { RecordModel } from 'pocketbase';

  let { 
    isOpen = false, 
    onClose, 
    photos = [], 
    record 
  } = $props();

  let currentIndex = $state(0);

  function next() {
      if (currentIndex < photos.length - 1) currentIndex++;
  }

  function prev() {
      if (currentIndex > 0) currentIndex--;
  }

  function getUrl(filename: string) {
      if (!record) return "";
      return pb.files.getURL(record as unknown as RecordModel, filename);
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
          onClose();
      } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prev();
      } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          next();
      }
  }

  function handleBackdropClick(e: MouseEvent) {
      // Only close if clicking directly on the backdrop, not on children
      if (e.target === e.currentTarget) {
          onClose();
      }
  }
</script>

{#if isOpen}
    <div 
        class="fixed inset-0 z-[9999] bg-black/80 flex flex-col items-center justify-center p-4 backdrop-blur-md cursor-pointer"
        transition:fade={{ duration: 200 }}
        onclick={handleBackdropClick}
        onkeydown={handleBackdropKeydown}
        role="dialog"
        aria-modal="true"
        aria-label="Photo gallery"
        tabindex="-1"
    >
        <!-- Close Button -->
        <button 
            class="absolute top-4 right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-20 backdrop-blur-sm"
            onclick={onClose}
            aria-label="Close gallery"
        >
            <X class="h-6 w-6" />
        </button>

        <!-- Main Image Container - Much larger now -->
        <div 
            class="relative w-full h-full max-w-[95vw] max-h-[85vh] flex items-center justify-center cursor-default"
            onclick={(e) => e.stopPropagation()}
            role="presentation"
        >
            {#key currentIndex}
                <img 
                    src={getUrl(photos[currentIndex])} 
                    alt="Expense attachment {currentIndex + 1} of {photos.length}" 
                    class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    transition:fade={{ duration: 200 }}
                />
            {/key}
            
            {#if photos.length > 1}
                <!-- Navigation -->
                {#if currentIndex > 0}
                    <button 
                        class="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10 backdrop-blur-sm"
                        onclick={(e) => { e.stopPropagation(); prev(); }}
                        aria-label="Previous photo"
                    >
                        <ChevronLeft class="h-8 w-8" />
                    </button>
                {/if}
                
                {#if currentIndex < photos.length - 1}
                    <button 
                        class="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10 backdrop-blur-sm"
                        onclick={(e) => { e.stopPropagation(); next(); }}
                        aria-label="Next photo"
                    >
                        <ChevronRight class="h-8 w-8" />
                    </button>
                {/if}
            {/if}
        </div>

        <!-- Indicators (outside the container for better visibility) -->
        {#if photos.length > 1}
            <div class="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20" aria-hidden="true">
                {#each photos as _, i (i)}
                    <button 
                        class={`h-2.5 w-2.5 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'}`}
                        onclick={(e) => { e.stopPropagation(); currentIndex = i; }}
                        aria-label="Go to photo {i + 1}"
                    ></button>
                {/each}
            </div>
        {/if}
    </div>
{/if}

