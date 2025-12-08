<script lang="ts">
  import { X, ChevronLeft, ChevronRight } from "lucide-svelte";
  import { fade, scale } from 'svelte/transition';
  import { pb } from '$lib/pocketbase';

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
      return pb.files.getURL(record, filename);
  }
</script>

{#if isOpen}
    <div 
        class="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
        transition:fade={{ duration: 200 }}
    >
        <!-- Close Button -->
        <button 
            class="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onclick={onClose}
        >
            <X class="h-6 w-6" />
        </button>

        <!-- Main Image -->
        <div class="relative w-full max-w-4xl aspect-[4/3] flex items-center justify-center">
            {#key currentIndex}
                <img 
                    src={getUrl(photos[currentIndex])} 
                    alt="Expense attachment" 
                    class="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
                    transition:scale={{ start: 0.95, opacity: 0, duration: 200 }}
                />
            {/key}
            
            {#if photos.length > 1}
                <!-- Navigation -->
                {#if currentIndex > 0}
                    <button 
                        class="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                        onclick={(e) => { e.stopPropagation(); prev(); }}
                    >
                        <ChevronLeft class="h-8 w-8" />
                    </button>
                {/if}
                
                {#if currentIndex < photos.length - 1}
                    <button 
                        class="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                        onclick={(e) => { e.stopPropagation(); next(); }}
                    >
                        <ChevronRight class="h-8 w-8" />
                    </button>
                {/if}

                <!-- Indicators -->
                <div class="absolute -bottom-12 left-0 right-0 flex justify-center gap-2">
                    {#each photos as _, i}
                        <div class={`h-2 w-2 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/30'}`}></div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}
