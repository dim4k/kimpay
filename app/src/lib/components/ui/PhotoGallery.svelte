<script lang="ts">
  import { ChevronLeft, ChevronRight } from "lucide-svelte";
  import { fade } from 'svelte/transition';
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
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
        class="fixed inset-0 z-[9999] bg-black/60 flex flex-col items-center justify-center p-4 backdrop-blur-md"
        transition:fade={{ duration: 200 }}
        onclick={onClose}
        role="dialog"
        tabindex="-1"
    >
        <!-- Main Image -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
            class="relative w-full max-w-4xl aspect-[4/3] flex items-center justify-center"
            onclick={(e) => e.stopPropagation()}
        >
            {#key currentIndex}
                <img 
                    src={getUrl(photos[currentIndex])} 
                    alt="Expense attachment" 
                    class="absolute inset-0 w-full h-full object-contain rounded-lg shadow-2xl"
                    transition:fade={{ duration: 200 }}
                />
            {/key}
            
            {#if photos.length > 1}
                <!-- Navigation -->
                {#if currentIndex > 0}
                    <button 
                        class="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors z-10 backdrop-blur-sm"
                        onclick={(e) => { e.stopPropagation(); prev(); }}
                    >
                        <ChevronLeft class="h-8 w-8" />
                    </button>
                {/if}
                
                {#if currentIndex < photos.length - 1}
                    <button 
                        class="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors z-10 backdrop-blur-sm"
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
