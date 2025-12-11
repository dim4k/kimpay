<script lang="ts">
  import Background from '$lib/components/ui/Background.svelte';
  import HomeHero from '$lib/components/home/HomeHero.svelte';
  import CreateKimpayForm from '$lib/components/home/CreateKimpayForm.svelte';
  import JoinKimpayForm from '$lib/components/home/JoinKimpayForm.svelte';
  import RecentKimpaysList from '$lib/components/home/RecentKimpaysList.svelte';
  import { recentsService } from '$lib/services/recents.svelte';
  import { offlineService } from '$lib/services/offline.svelte';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  // Fast check for initial render to avoid flash if possible
  let showHero = $state(false);
  
  // Determine if we should show hero based on store
  $effect(() => {
      if (recentsService.initialized) {
          showHero = recentsService.recentKimpays.length === 0;
      } else if (browser) {
          // Fallback optimistic check while loading
           const raw = localStorage.getItem('my_kimpays');
           if (!raw || raw === "{}") {
               showHero = true;
           }
      }
  });

  onMount(async () => {
      // Store init handles deduplication
      recentsService.init();
  });
</script>


<!-- Background Blobs & Icons -->
<!-- Background -->
<Background />

<div class="relative z-10 flex flex-col items-center p-4 pb-4 w-full max-w-md mx-auto mt-4 md:mt-8">

    {#if showHero}
        <HomeHero />
    {/if}
    
    {#if !offlineService.isOffline}
    <div class="bg-card p-4 md:p-6 rounded-2xl shadow-sm border space-y-4 md:space-y-6 w-full transition-colors animate-pop-in" style="animation-delay: 150ms;">
        <CreateKimpayForm />
        <JoinKimpayForm />
    </div>
    {/if}

    <!-- History Section -->
    <RecentKimpaysList />
  
</div>

