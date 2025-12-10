<script lang="ts">
  import { page } from '$app/state';
  import { ChartPie, Settings, Plus, Share2, Wallet } from "lucide-svelte";
  import { t } from '$lib/i18n';
  import { setContext } from 'svelte';
  
  import { appState } from '$lib/stores/appState.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import { goto } from '$app/navigation';
  
  let { children, data } = $props();

  let kimpayId = $derived(page.params.id ?? '');
  let participants = $derived(data.participants || []);
  
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
      
      const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
      const storedUser = myKimpays[kimpayId] || localStorage.getItem(`kimpay_user_${kimpayId}`);
      
      if (!storedUser) {
          // Open global identity modal
          modals.identity({
              kimpayId,
              participants
          });
      } else {
        // Init state
        await appState.init(kimpayId);
      }
  }

  $effect(() => {
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
            
            <!-- Expenses (Home) -->

            <a 
                href="/k/{kimpayId}" 
                class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {page.url.pathname.endsWith(kimpayId) ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
            >
                <div class="relative">
                    <Wallet class="h-6 w-6" strokeWidth={page.url.pathname.endsWith(kimpayId) ? 2.5 : 2} />
                    {#if page.url.pathname.endsWith(kimpayId)}
                         <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    {/if}
                </div>
                <span class="text-[10px] font-medium tracking-wide">{$t('nav.expenses')}</span>
            </a>

            <!-- Balance -->

            <a 
                href="/k/{kimpayId}/balance" 
                class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {page.url.pathname.includes('/balance') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
            >
                <div class="relative">
                    <ChartPie class="h-6 w-6" strokeWidth={page.url.pathname.includes('/balance') ? 2.5 : 2} />
                    {#if page.url.pathname.includes('/balance')}
                         <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    {/if}
                </div>
                <span class="text-[10px] font-medium tracking-wide">{$t('nav.balance')}</span>
            </a>

            <!-- Spacer for FAB (Center) -->
            <div class="pointer-events-none"></div>

            <!-- Share (New) -->

            <a 
                href="/k/{kimpayId}/share" 
                class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {page.url.pathname.includes('/share') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
            >
                <div class="relative">
                     <Share2 class="h-6 w-6" strokeWidth={page.url.pathname.includes('/share') ? 2.5 : 2} />
                     {#if page.url.pathname.includes('/share')}
                         <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    {/if}
                </div>
                <span class="text-[10px] font-medium tracking-wide">{$t('nav.share')}</span>
            </a>

            <!-- Settings -->

            <a 
                href="/k/{kimpayId}/settings" 
                class="flex flex-col items-center justify-center pb-2 gap-1 transition-colors {page.url.pathname.includes('/settings') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}"
            >
                <div class="relative">
                     <Settings class="h-6 w-6" strokeWidth={page.url.pathname.includes('/settings') ? 2.5 : 2} />
                     {#if page.url.pathname.includes('/settings')}
                         <span class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    {/if}
                </div>
                <span class="text-[10px] font-medium tracking-wide">{$t('nav.settings')}</span>
            </a>
        </div>
    </nav>
    

    <!-- Floating Action Button Container (Centered - Mounted LAST to stay on top visually if same z-index, but we use z-50) -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-50">

        <a 
            href="/k/{kimpayId}/add" 
            class="flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-full h-16 w-16 shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 transition-transform duration-200 ring-4 ring-slate-50 dark:ring-slate-950"
        >
            <Plus class="h-8 w-8" strokeWidth={2.5} />
        </a>
    </div>
</div>
