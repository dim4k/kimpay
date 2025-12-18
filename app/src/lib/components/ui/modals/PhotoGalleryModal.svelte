<script lang="ts">
  import { ChevronLeft, ChevronRight, X } from "lucide-svelte";
  import { fade } from 'svelte/transition';
  import { pb } from '$lib/pocketbase';
  import type { RecordModel } from 'pocketbase';
  import Modal from './Modal.svelte';

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

  function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prev();
      } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          next();
      }
  }
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

<Modal 
    {isOpen} 
    onClose={onClose}
    class="w-full h-full max-w-[95vw] max-h-[85vh] bg-transparent shadow-none border-none p-0 flex items-center justify-center"
    backdropClass="bg-black/90 backdrop-blur-md"
>
    <!-- Close Button -->
    <button 
        class="fixed top-4 right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-50 backdrop-blur-sm"
        onclick={onClose}
        aria-label="Close gallery"
    >
        <X class="h-6 w-6" />
    </button>

    <!-- Main Image Container -->
    <div 
        class="relative w-full h-full flex items-center justify-center"
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

    <!-- Indicators -->
    {#if photos.length > 1}
        <div class="fixed bottom-6 left-0 right-0 flex justify-center gap-2 z-50" aria-hidden="true">
            {#each photos as _, i (i)}
                <button 
                    class={`h-2.5 w-2.5 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'}`}
                    onclick={(e) => { e.stopPropagation(); currentIndex = i; }}
                    aria-label="Go to photo {i + 1}"
                ></button>
            {/each}
        </div>
    {/if}
</Modal>

