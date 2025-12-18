<script lang="ts">
  import Background from '$lib/components/ui/Background.svelte';
  import HomeHero from '$lib/components/home/HomeHero.svelte';
  import CreateKimpayForm from '$lib/components/home/CreateKimpayForm.svelte';
  import JoinKimpayForm from '$lib/components/home/JoinKimpayForm.svelte';
  import RecentKimpaysList from '$lib/components/home/RecentKimpaysList.svelte';
  import RecoverKimpaysForm from '$lib/components/home/RecoverKimpaysForm.svelte';
  import MyKimpaysList from '$lib/components/home/MyKimpaysList.svelte';
  import CollapsibleCard from '$lib/components/ui/CollapsibleCard.svelte';
  import { recentsService } from '$lib/services/recents.svelte';
  import { offlineService } from '$lib/services/offline.svelte';
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { Plus, ArrowRight, CloudOff } from 'lucide-svelte';
  import { t } from '$lib/i18n';



  // Fast check for initial render to avoid flash if possible
  let showHero = $state(false);
  
  // Collapsible state
  let isCreateExpanded = $state(false);
  let isJoinExpanded = $state(false);
  
  // Determine if we should show hero based on store
  $effect(() => {
      if (recentsService.initialized) {
          showHero = recentsService.recentKimpays.length === 0;
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

<div class="relative z-10 flex flex-col items-center p-4 pb-4 w-full max-w-2xl mx-auto mt-4 md:mt-8">

    {#if auth.isValid}
        <!-- Logged In View -->
        <div class="w-full space-y-6">
            <MyKimpaysList />

            <!-- Collapsible Create Section -->
            <div class="animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
                <CollapsibleCard title={$t('home.create.title')} bind:isOpen={isCreateExpanded}>
                    {#snippet icon()}
                         <div class="h-9 w-9 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                             <Plus class="h-5 w-5" />
                         </div>
                    {/snippet}
                    <CreateKimpayForm hideTitle={true} />
                </CollapsibleCard>
            </div>

            <!-- Join Section -->
            <div class="mt-4 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
                <CollapsibleCard title={$t('home.join.accordion_title')} bind:isOpen={isJoinExpanded}>
                    {#snippet icon()}
                         <div class="h-9 w-9 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                            <ArrowRight class="h-5 w-5" />
                         </div>
                    {/snippet}
                    <JoinKimpayForm hideTitle={true} />
                </CollapsibleCard>
            </div>
        </div>

    {:else}
        <!-- Guest View -->
        {#if showHero}
            <HomeHero />
        {/if}
        
        {#if offlineService.isOffline}
            <!-- Offline message for guests -->
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center space-y-3 w-full animate-pop-in" style="animation-delay: 150ms;">
                <CloudOff class="h-10 w-10 mx-auto text-amber-500" />
                <div class="space-y-1">
                    <p class="font-semibold text-amber-800 dark:text-amber-200">{$t('home.offline.title')}</p>
                    <p class="text-sm text-amber-600 dark:text-amber-400">{$t('home.offline.desc')}</p>
                </div>
            </div>
        {:else}
        <div class="bg-card p-4 md:p-6 rounded-2xl shadow-sm border space-y-4 md:space-y-6 w-full transition-colors animate-pop-in" style="animation-delay: 150ms;">
            <CreateKimpayForm />
            <JoinKimpayForm />
        </div>
        {/if}

        <!-- History Section -->
        <RecentKimpaysList />
        <RecoverKimpaysForm />
    {/if}
  
</div>

