<script lang="ts">
  import { page } from '$app/state';
  import { ChartPie, Settings, Share2, Wallet } from "lucide-svelte";
  import { t } from '$lib/i18n';
  import { setContext } from 'svelte';
  import { ActiveKimpay } from '$lib/stores/activeKimpay.svelte';
  
  import { modals } from '$lib/stores/modals.svelte';
  import { goto, afterNavigate } from '$app/navigation';
  import { fabState } from '$lib/stores/fab.svelte';
  import { scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { storageService } from '$lib/services/storage';
  import NavItem from '$lib/components/ui/NavItem.svelte';
  
  import { onDestroy } from 'svelte';
  
  let { children } = $props();
  
  // Initialize ActiveKimpay
  let activeKimpay = $state<ActiveKimpay>();
  
  // Only recreate when ID changes, NOT on every navigation within the Kimpay
  $effect(() => {
      const id = page.params.id;
      if (activeKimpay?.id !== id) {
          activeKimpay?.destroy();
          if (id) activeKimpay = new ActiveKimpay(id);
      }
      // NOTE: No cleanup here! Cleanup in onDestroy only.
  });
  
  // Cleanup only when truly leaving the Kimpay context (component unmount)
  onDestroy(() => {
      activeKimpay?.destroy();
  });

  // Provide context
  setContext('ACTIVE_KIMPAY', { get value() { return activeKimpay; } });

  // Derived values
  let kimpayId = $derived(activeKimpay?.id ?? page.params.id ?? '');
  let participants = $derived(activeKimpay?.participants || []);

  $effect(() => {
      // Ensure defaults when kimpayId changes or route changes not handled by child
      if (kimpayId && !page.url.pathname.includes('/add') && !page.url.pathname.includes('/edit')) {
            fabState.reset(kimpayId);
      }
  });
  
  // Context for child pages to know when to refresh data
  let refreshSignal = $state({ count: 0 });
  setContext('refreshSignal', refreshSignal);

  // Swipe Logic
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  const minSwipeDistance = 50;

  function handleTouchStart(e: TouchEvent) {
      const touch = e.changedTouches[0];
      if (touch) {
          touchStartX = touch.screenX;
          touchStartY = touch.screenY;
      }
  }

  function handleTouchEnd(e: TouchEvent) {
      const touch = e.changedTouches[0];
      if (touch) {
          touchEndX = touch.screenX;
          touchEndY = touch.screenY;
          handleSwipe();
      }
  }

  function handleSwipe() {
      const xDistance = touchStartX - touchEndX;
      const yDistance = touchStartY - touchEndY;
      
      // Ignore if vertical scroll is dominant
      if (Math.abs(yDistance) > Math.abs(xDistance)) return;

      const isLeftSwipe = xDistance > minSwipeDistance;
      const isRightSwipe = xDistance < -minSwipeDistance;

      if (isLeftSwipe) {
          navigate(1);
      } else if (isRightSwipe) {
          navigate(-1);
      }
  }

  function navigate(direction: number) {
      const routes = [
          `/k/${kimpayId}`,
          `/k/${kimpayId}/balance`,
          `/k/${kimpayId}/share`,
          `/k/${kimpayId}/settings`
      ];

      const currentPath = page.url.pathname;
      let currentIndex = -1;
      
      if (currentPath.endsWith('/balance')) currentIndex = 1;
      else if (currentPath.endsWith('/share')) currentIndex = 2;
      else if (currentPath.endsWith('/settings')) currentIndex = 3;
      else if (currentPath === `/k/${kimpayId}` || currentPath === `/k/${kimpayId}/`) currentIndex = 0;
      
      if (currentIndex === -1) return; 

      const nextIndex = currentIndex + direction;
      const nextRoute = routes[nextIndex];

      if (nextRoute) {
          goto(nextRoute);
      }
  }

  
  async function checkIdentity() {
      if (!kimpayId) return;
      
      // The load function already initialized stores with data.
      // This function only needs to open the identity modal if no user is stored.
      const storedUser = await storageService.getMyParticipantId(kimpayId);
      
      if (!storedUser) {
          // Open global identity modal
          modals.identity({
              kimpayId,
              participants
          });
      } else {
          // Just ensure the participant identity is set in the store  
          // participantsStore.setMyIdentity(kimpayId);
      }
  }

  // Only run checkIdentity after navigation completes to avoid stale state
  afterNavigate(() => {
     if (kimpayId) checkIdentity();
  });
</script>

<div 
    class="flex-1 bg-slate-50 dark:bg-background pb-20 transition-colors"
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
> <!-- pb-20 for bottom nav -->
  {@render children()}
</div>


<div class="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
    <!-- Navigation Bar -->
    <nav class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800 shadow-2xl safe-area-pb pointer-events-auto relative z-40 transition-colors">
        <div class="grid grid-cols-5 h-[4.5rem] items-end pb-2">
            <NavItem 
                href="/k/{kimpayId}" 
                icon={Wallet} 
                label={$t('nav.expenses')} 
                isActive={page.url.pathname.endsWith(kimpayId)} 
            />

            <NavItem 
                href="/k/{kimpayId}/balance" 
                icon={ChartPie} 
                label={$t('nav.balance')} 
                isActive={page.url.pathname.includes('/balance')} 
            />

            <!-- Spacer for FAB (Center) -->
            <div class="pointer-events-none"></div>

            <NavItem 
                href="/k/{kimpayId}/share" 
                icon={Share2} 
                label={$t('nav.share')} 
                isActive={page.url.pathname.includes('/share')} 
            />

            <NavItem 
                href="/k/{kimpayId}/settings" 
                icon={Settings} 
                label={$t('nav.settings')} 
                isActive={page.url.pathname.includes('/settings')} 
            />
        </div>
    </nav>
    

    <!-- Floating Action Button Container (Centered - Mounted LAST to stay on top visually if same z-index, but we use z-50) -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-50">
        {#if fabState.visible}
            <!-- Use a keyed block only for swapping between A and BUTTON tags if strictly necessary, 
                 but actually we want to preserve the container's presence for coordinate transitions if possible. 
                 Since they are different tags, simple conditional is fine, Svelte handles the DOM swap. 
                 The important part is NOT to key the whole thing on every prop change. -->
            
            {#if fabState.href}
                <a 
                    href={fabState.href} 
                    class="flex items-center justify-center {fabState.colorClass} text-white rounded-full h-16 w-16 shadow-xl hover:scale-105 transition-all duration-300 ring-4 ring-slate-50 dark:ring-slate-950 animate-in zoom-in-50"
                    title={fabState.label}
                >
                    {#key fabState.icon}
                        <div class="absolute inset-0 flex items-center justify-center" in:scale={{ start: 0.5, duration: 300, easing: cubicOut }} out:scale={{ start: 0, opacity: 0, duration: 200 }}>
                            <fabState.icon class="h-8 w-8" strokeWidth={2.5} />
                        </div>
                    {/key}
                </a>
            {:else}
                    <button
                    onclick={fabState.onClick}
                    disabled={fabState.disabled}
                    class="flex items-center justify-center {fabState.disabled ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500' : fabState.colorClass} text-white rounded-full h-16 w-16 shadow-xl hover:scale-105 transition-all duration-300 ring-4 ring-slate-50 dark:ring-slate-950 animate-in zoom-in-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    title={fabState.label}
                    aria-label={fabState.label}
                    >
                    {#key fabState.icon}
                        <div class="absolute inset-0 flex items-center justify-center" in:scale={{ start: 0.5, duration: 300, easing: cubicOut }} out:scale={{ start: 0, opacity: 0, duration: 200 }}>
                            <fabState.icon class="h-8 w-8" strokeWidth={2.5} />
                        </div>
                    {/key}
                    </button>
            {/if}
        {/if}
    </div>
</div>
