<script lang="ts">
  import { Languages, ChevronDown, Check, Sun, Moon, Menu, Camera, RefreshCw, WifiOff, LogOut, LayoutDashboard, UserPlus, Settings } from "lucide-svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { locale, t } from '$lib/i18n';
  import { theme } from '$lib/theme';
  import { slide } from 'svelte/transition';
  import { pb } from '$lib/pocketbase';
  import { activeKimpayGlobal } from '$lib/stores/activeKimpayGlobal.svelte';
  import { recentsService } from '$lib/services/recents.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  import LoginHelpModal from '$lib/components/ui/modals/LoginHelpModal.svelte';
  import OfflineHelpModal from '$lib/components/ui/modals/OfflineHelpModal.svelte';
  import { offlineService } from '$lib/services/offline.svelte';
  import { afterNavigate, invalidateAll } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { page } from '$app/state';
  import { haptic } from '$lib/utils/haptic';

  let isMenuOpen = $state(false);
  let isLangOptionsOpen = $state(false);
  let isMyKimpaysOpen = $state(false);
  let showOfflineHelp = $state(false);
  let isLoginHelpOpen = $state(false);
  
  let menuRef = $state<HTMLElement | null>(null);
  let triggerRef = $state<HTMLElement | null>(null);
  let fileInputRef = $state<HTMLInputElement | null>(null);
  
  // Only show Kimpay context if we are actually on a /k/[id] route
  let isInKimpayContext = $derived(page.url.pathname.startsWith('/k/'));
  let currentParticipant = $derived(isInKimpayContext ? activeKimpayGlobal.myParticipant : null);
  let currentKimpay = $derived(isInKimpayContext ? activeKimpayGlobal.kimpay : null);

  afterNavigate(() => {
      isMenuOpen = false;
  });

  async function handleAvatarChange(e: Event) {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files[0] && currentParticipant) {
           const file = input.files[0];
           try {
              // TODO: Move this to ActiveKimpay or ParticipantService
              await pb.collection('participants').update(currentParticipant.id, { avatar: file });
              // Update global state and UI
              // Repopulation happens via store reactivity now
              await invalidateAll();
           } catch (err) {
               console.error("Failed to update avatar", err);
           }
      }
  }

  function openIdentityModal() {
      if (!currentKimpay) return;
      isMenuOpen = false;
      modals.identity({
          kimpayId: currentKimpay.id,
          participants: activeKimpayGlobal.kimpay?.expand?.participants_via_kimpay || []
      });
  }

  function handleOutsideClick(event: MouseEvent) {
      if (
          isMenuOpen && 
          menuRef && 
          triggerRef && 
          !menuRef.contains(event.target as Node) && 
          !triggerRef.contains(event.target as Node)
      ) {
          isMenuOpen = false;
      }
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<header class="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md dark:bg-slate-900/80 dark:border-slate-800">
  <div class="container flex h-16 items-center justify-between px-4">

      <a href="/" onclick={() => haptic('light')} class="flex items-center transition-transform hover:scale-105">
          <Logo class="h-8 w-8 text-indigo-700 dark:text-indigo-400" />
          <span class="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden {currentKimpay ? 'max-w-0 opacity-0 ml-0 md:max-w-xs md:opacity-100 md:ml-2' : 'max-w-xs opacity-100 ml-2'}">Kimpay</span>
      </a>

      {#if offlineService.isOffline}
          <button 
                onclick={() => showOfflineHelp = true}
                class="ml-2 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 animate-in fade-in zoom-in-95 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                title={$t('offline.modal.title')}
          >
              <WifiOff class="h-3 w-3" />
              {$t('common.offline')}
          </button>
      {/if}

      <div class="flex items-center gap-2">
          <!-- Burger Menu -->
          <div class="relative">
              <button 
                  bind:this={triggerRef}
                  onclick={() => isMenuOpen = !isMenuOpen}
                  class={currentKimpay || auth.user
                    ? "flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all max-w-[200px] md:max-w-none" 
                    : "p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"}
                  title="Menu"
              >
                  {#if currentKimpay}
                     <!-- Inside Kimpay: Participant avatar, Participant name (grey), emoji + Kimpay name (white) -->
                     <Avatar 
                         name={currentParticipant ? currentParticipant.name : "?"} 
                         src={currentParticipant?.avatar ? pb.files.getURL(currentParticipant, currentParticipant.avatar) : null}
                         class="w-8 h-8 text-[10px]" 
                     />
                     <div class="flex flex-col items-start gap-0.5 min-w-0 text-left mr-1">
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none truncate max-w-[100px] md:max-w-none">
                            {currentParticipant ? currentParticipant.name : $t('common.unknown')}
                        </span>
                        <div class="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-100 text-xs leading-none">
                            <span class="text-sm">{currentKimpay.icon || '📁'}</span>
                            <span class="truncate max-w-[100px] md:max-w-[180px]">{currentKimpay.name}</span>
                        </div>
                     </div>
                     <ChevronDown class="h-3 w-3 text-slate-400 shrink-0" />
                  {:else if auth.user}
                     <!-- Homepage + Logged: User avatar, "Hello", User name -->
                     <Avatar name={auth.user.name} src={auth.user.avatar ? pb.files.getURL(auth.user, auth.user.avatar) : null} class="w-8 h-8 text-[10px]" />
                     <div class="flex flex-col items-start gap-0.5 min-w-0 text-left mr-1">
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none truncate max-w-[100px] md:max-w-none">{$t('common.hello')}</span>
                        <div class="font-bold text-slate-800 dark:text-slate-100 text-xs leading-none truncate max-w-[120px]">
                            {auth.user.name}
                        </div>
                     </div>
                     <ChevronDown class="h-3 w-3 text-slate-400 shrink-0" />
                  {:else}
                    <!-- Homepage + Not logged: Burger -->
                    <Menu class="h-6 w-6" />
                  {/if}
              </button>

              {#if isMenuOpen}
                   <div 
                       bind:this={menuRef}
                       class="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col"
                       transition:slide={{ duration: 200 }}
                   >
                      <!-- Main Navigation Section -->
                      <div class="max-h-[70vh] overflow-y-auto py-2">
                          
                          {#if currentKimpay}
                              <div class="px-4 pt-3 pb-1 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 mb-2">
                                  <!-- Kimpay Title (Non-clickable Header) -->
                                  <div class="flex items-center gap-2 mb-3 opacity-90">
                                      <span class="text-xl leading-none">{currentKimpay.icon || '📁'}</span>
                                      <h3 class="font-extrabold text-slate-900 dark:text-slate-100 text-sm truncate">{currentKimpay.name}</h3>
                                  </div>

                                  <div class="flex items-center gap-3 pb-3">
                                      <div class="relative group">
                                           <Avatar 
                                               name={currentParticipant ? currentParticipant.name : "?"} 
                                               src={currentParticipant?.avatar ? pb.files.getURL(currentParticipant, currentParticipant.avatar) : null}
                                               class="w-12 h-12 text-xl" 
                                           />
                                           {#if currentParticipant && !offlineService.isOffline}
                                           <button 
                                              class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                              onclick={() => fileInputRef?.click()}
                                           >
                                               <Camera class="h-5 w-5 text-white" />
                                           </button>
                                           <input 
                                              type="file" 
                                              accept="image/*"
                                              multiple
                                              class="hidden" 
                                              bind:this={fileInputRef}
                                              onchange={handleAvatarChange}
                                          />
                                           {/if}
                                      </div>
                                      <div class="flex-1 min-w-0">
                                          <div class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                              {currentParticipant ? currentParticipant.name : $t('identity.title')}
                                          </div>
                                          {#if !offlineService.isOffline}
                                            <div class="flex flex-col items-start gap-1 mt-0.5">
                                                <button 
                                                    onclick={openIdentityModal}
                                                    class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                                >
                                                    <RefreshCw class="h-3 w-3" />
                                                    {$t('identity.change')} 
                                                </button>
                                                
                                                
                                            </div>
                                          {/if}
                                      </div>
                                  </div>
                                  
                              </div>
                          {/if}

                          {#if !auth.user}
                              <div class="px-4 py-2 flex items-center gap-2 mb-2">
                                  <button 
                                      onclick={() => {
                                          isMenuOpen = false;
                                          modals.register({});
                                      }}
                                      class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
                                  >
                                      <UserPlus class="h-4 w-4" />
                                      {$t('register.button')}
                                  </button>
                                  <button 
                                      onclick={() => {
                                          isMenuOpen = false;
                                          isLoginHelpOpen = true;
                                      }}
                                      class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                  >
                                      {$t('login_help.button', { default: 'Login' })}
                                  </button>
                              </div>
                          {/if}

                          <!-- My Kimpays Section (for all users) -->
                          <div class="px-2 pb-2">
                              <button 
                                  onclick={() => isMyKimpaysOpen = !isMyKimpaysOpen}
                                  class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                              >
                                  <div class="flex items-center gap-3">
                                      <LayoutDashboard class="h-5 w-5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                                      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{$t('my_kimpays.title', { default: 'My Kimpays' })}</span>
                                  </div>
                                  <ChevronDown class="h-4 w-4 text-slate-400 transition-transform {isMyKimpaysOpen ? 'rotate-180' : ''}" />
                              </button>
                              
                              {#if isMyKimpaysOpen}
                                  <div class="pl-2 pr-1 pb-1 space-y-1" transition:slide={{ duration: 150 }}>
                                      <!-- Home link -->
                                      <a 
                                          href="/"
                                          onclick={() => haptic('light')}
                                          class="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                      >
                                          <span class="text-base">🏠</span>
                                          <span class="font-medium">Home</span>
                                      </a>
                                      
                                      {#if recentsService.recentKimpays.length === 0}
                                          <div class="px-4 py-3 text-sm text-slate-500 italic text-center">
                                              {$t('my_kimpays.empty', { default: 'No Kimpays yet.' })}
                                          </div>
                                      {:else}
                                          {@const filteredKimpays = recentsService.recentKimpays.filter(k => k.id !== currentKimpay?.id)}
                                          {#each filteredKimpays as k (k.id)}
                                              <a 
                                                  href="/k/{k.id}" 
                                                  data-sveltekit-preload-data="off"
                                                  onclick={() => haptic('light')}
                                                  class="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                              >
                                                  <span class="text-base">{k.icon || "📁"}</span>
                                                  <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{k.name}</span>
                                              </a>
                                          {/each}
                                          {#if filteredKimpays.length === 0 && currentKimpay}
                                              <div class="px-4 py-2 text-sm text-slate-400 italic">
                                                  {$t('my_kimpays.empty', { default: 'No other Kimpays.' })}
                                              </div>
                                          {/if}
                                      {/if}
                                  </div>
                              {/if}
                          </div>
                      </div>

                      <!-- Settings Section (Bottom) -->
                      <div class="bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 p-2 space-y-1">
                          <!-- Theme Toggle -->
                          <button 
                              onclick={theme.toggle}
                              class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors group"
                          >
                              <div class="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium text-sm">
                                  {#if $theme === 'dark'}
                                      <Moon class="h-4 w-4" />
                                  {:else}
                                      <Sun class="h-4 w-4" />
                                  {/if}
                                  <span>{$t('menu.theme')}</span>
                              </div>
                              <span class="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded text-slate-500">
                                  {$theme === 'dark' ? $t('menu.theme.dark') : $t('menu.theme.light')}
                              </span>
                          </button>

                          <!-- Language Selector -->
                          <div class="space-y-1">
                              <button 
                                  onclick={() => isLangOptionsOpen = !isLangOptionsOpen}
                                  class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors group"
                              >
                                  <div class="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium text-sm">
                                      <Languages class="h-4 w-4" />
                                      <span>{$t('menu.language')}</span>
                                  </div>
                                  <div class="flex items-center gap-2">
                                      <span class="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded text-slate-500 uppercase">
                                          {$locale}
                                      </span>
                                      <ChevronDown class="h-3 w-3 text-slate-400 transition-transform {isLangOptionsOpen ? 'rotate-180' : ''}" />
                                  </div>
                              </button>

                              {#if isLangOptionsOpen}
                                  <div class="pl-2 pr-1 pb-1 space-y-1" transition:slide={{ duration: 150 }}>
                                      <button 
                                          class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm transition-colors {$locale === 'en' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-600 dark:text-slate-400'}"
                                          onclick={() => { locale.set('en'); isLangOptionsOpen = false; }}
                                      >
                                          <span class="font-medium">English</span>
                                          {#if $locale === 'en'} <Check class="h-3 w-3" /> {/if}
                                      </button>
                                      <button 
                                          class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm transition-colors {$locale === 'fr' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-600 dark:text-slate-400'}"
                                          onclick={() => { locale.set('fr'); isLangOptionsOpen = false; }}
                                      >
                                          <span class="font-medium">Français</span>
                                          {#if $locale === 'fr'} <Check class="h-3 w-3" /> {/if}
                                      </button>
                                      <button 
                                          class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm transition-colors {$locale === 'de' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-600 dark:text-slate-400'}"
                                          onclick={() => { locale.set('de'); isLangOptionsOpen = false; }}
                                      >
                                          <span class="font-medium">Deutsch</span>
                                          {#if $locale === 'de'} <Check class="h-3 w-3" /> {/if}
                                      </button>
                                      <button 
                                          class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm transition-colors {$locale === 'es' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-600 dark:text-slate-400'}"
                                          onclick={() => { locale.set('es'); isLangOptionsOpen = false; }}
                                      >
                                          <span class="font-medium">Español</span>
                                          {#if $locale === 'es'} <Check class="h-3 w-3" /> {/if}
                                      </button>
                                      <button 
                                          class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm transition-colors {$locale === 'pt' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-600 dark:text-slate-400'}"
                                          onclick={() => { locale.set('pt'); isLangOptionsOpen = false; }}
                                      >
                                          <span class="font-medium">Português</span>
                                          {#if $locale === 'pt'} <Check class="h-3 w-3" /> {/if}
                                      </button>
                                  </div>
                              {/if}
                          </div>

                          {#if auth.user}
                              <hr class="border-border/50 dark:border-slate-800" />
                              <a 
                                  href="/settings"
                                  class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors group"
                              >
                                  <Settings class="h-4 w-4" />
                                  <span class="font-medium text-sm">{$t('user_settings.title')}</span>
                              </a>
                              <button 
                                  onclick={() => {
                                      isMenuOpen = false;
                                      modals.confirm({
                                          title: $t('modal.logout.title'),
                                          description: $t('modal.logout.desc'),
                                          confirmText: $t('modal.logout.confirm'),
                                          variant: 'destructive',
                                          onConfirm: () => {
                                              auth.logout();
                                              window.location.href = "/";
                                          }
                                      });
                                  }}
                                  class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors group"
                              >
                                  <LogOut class="h-4 w-4" />
                                  <span class="font-medium text-sm">{$t('auth.logout')}</span>
                              </button>
                          {/if}
                      </div>
                   </div>
              {/if}
          </div>
      </div>
  </div>
</header>

<OfflineHelpModal isOpen={showOfflineHelp} onClose={() => showOfflineHelp = false} />
<LoginHelpModal isOpen={isLoginHelpOpen} onClose={() => isLoginHelpOpen = false} />
