<script lang="ts">
  import { ChevronLeft, ChevronRight, X } from "@lucide/svelte";
  import { fade } from 'svelte/transition';
  import { pb } from '#lib/pocketbase.js';
  import type { RecordModel } from 'pocketbase';
  import { untrack } from 'svelte';
  import Modal from './Modal.svelte';
  import { t } from '#lib/i18n.js';
  import type { GalleryOptions } from '#lib/stores/modals.svelte.js';

  let {
    isOpen = false,
    onClose,
    photos = [],
    record,
    start = 0,
  }: {
    isOpen?: boolean;
    onClose: () => void;
    photos?: string[];
    record: GalleryOptions["record"] | null;
    /** Index of the photo shown first */
    start?: number | undefined;
  } = $props();

  // Mounted for each opening: starts on the photo tapped.
  let currentIndex = $state(untrack(() => start ?? 0));

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

  // A swipe sideways goes to the next or previous photo.
  let swipeFrom: number | null = null;

  function swipeEnd(e: PointerEvent) {
      if (swipeFrom === null) return;
      const dx = e.clientX - swipeFrom;
      swipeFrom = null;
      if (Math.abs(dx) < 50) return;
      if (dx < 0) next();
      else prev();
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
    label={$t('expense.form.photos_label')}
    class="w-full h-full max-w-[95vw] max-h-[85vh] bg-transparent shadow-none border-none p-0 flex items-center justify-center"
    backdropClass="bg-black/90 backdrop-blur-md"
>
    <!-- Close Button -->
    <button 
        class="fixed top-4 right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-50 backdrop-blur-xs"
        onclick={onClose}
        aria-label={$t('common.close')}
    >
        <X class="h-6 w-6" />
    </button>

    <!-- Main Image Container -->
    <div 
        class="relative w-full h-full flex items-center justify-center touch-pan-y"
        role="presentation"
        onpointerdown={(e) => (swipeFrom = e.clientX)}
        onpointerup={swipeEnd}
        onpointercancel={() => (swipeFrom = null)}
    >
        {#key currentIndex}
            <img 
                src={getUrl(photos[currentIndex] ?? "")} 
                alt={$t('gallery.photo_alt', { current: String(currentIndex + 1), total: String(photos.length) })} 
                class="max-w-full max-h-full object-contain rounded-control shadow-2xl"
                transition:fade={{ duration: 200 }}
            />
        {/key}
        
        {#if photos.length > 1}
            <!-- Navigation -->
            {#if currentIndex > 0}
                <button 
                    class="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10 backdrop-blur-xs"
                    onclick={(e) => { e.stopPropagation(); prev(); }}
                    aria-label={$t('gallery.previous')}
                >
                    <ChevronLeft class="h-8 w-8" />
                </button>
            {/if}
            
            {#if currentIndex < photos.length - 1}
                <button 
                    class="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10 backdrop-blur-xs"
                    onclick={(e) => { e.stopPropagation(); next(); }}
                    aria-label={$t('gallery.next')}
                >
                    <ChevronRight class="h-8 w-8" />
                </button>
            {/if}
        {/if}
    </div>

    <!-- Indicators -->
    {#if photos.length > 1}
        <div class="fixed bottom-4 left-0 right-0 flex justify-center z-50">
            {#each photos as _, i (i)}
                <!-- A small dot in a target big enough for a finger. -->
                <button 
                    type="button"
                    class="group flex h-8 w-8 items-center justify-center"
                    onclick={(e) => { e.stopPropagation(); currentIndex = i; }}
                    aria-label={$t('gallery.go_to', { n: String(i + 1) })}
                    aria-current={i === currentIndex ? 'true' : undefined}
                >
                    <span class="h-2.5 w-2.5 rounded-full transition-colors {i === currentIndex ? 'bg-white' : 'bg-white/40 group-hover:bg-white/60'}"></span>
                </button>
            {/each}
        </div>
    {/if}
</Modal>

