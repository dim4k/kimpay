<script lang="ts">
  import { Languages, ChevronDown, Check, Sun, Moon, Menu, Plus, Camera, RefreshCw, WifiOff } from "lucide-svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { locale, t } from '$lib/i18n';
  import { theme } from '$lib/theme';
  import { slide } from 'svelte/transition';
  import { pb } from '$lib/pocketbase';
  import { appState } from '$lib/stores/appState.svelte';
  import { recentsService } from '$lib/services/recents.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import OfflineHelpModal from '$lib/components/ui/OfflineHelpModal.svelte';
  import { offlineService } from '$lib/services/offline.svelte';
  import { invalidateAll, afterNavigate } from '$app/navigation';

  let isMenuOpen = $state(false);
  let isLangOptionsOpen = $state(false);
  let showOfflineHelp = $state(false);
  
  let menuRef = $state<HTMLElement | null>(null);
  let triggerRef = $state<HTMLElement | null>(null);
  let fileInputRef = $state<HTMLInputElement | null>(null);
  
  let currentParticipant = $derived(appState.participant);
  let currentKimpay = $derived(appState.kimpay);

  afterNavigate(() => {
      isMenuOpen = false;
  });

  async function handleAvatarChange(e: Event) {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files[0] && currentParticipant) {
           const file = input.files[0];
           try {
              await appState.updateParticipant(currentParticipant.id, { avatar: file });
              // Update global state and UI
              await appState.init(currentParticipant.kimpay, true);
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
          participants: appState.participants
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

      <a href="/" class="flex items-center transition-transform hover:scale-105">
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
                  class={currentKimpay && currentParticipant 
                    ? "flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all max-w-[200px] md:max-w-none" 
                    : "p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"}
                  title="Menu"
              >
                  {#if currentKimpay && currentParticipant}
                     <!-- Identity Trigger -->
                     <Avatar name={currentParticipant.name} src={currentParticipant.avatar ? pb.files.getURL(currentParticipant, currentParticipant.avatar) : null} class="w-8 h-8 text-[10px]" />
                     <div class="flex flex-col items-start gap-0.5 min-w-0 text-left mr-1">
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none truncate max-w-[100px] md:max-w-none">{currentParticipant.name}</span>
                        <div class="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs leading-none">
                            <span class="hidden md:inline">{currentKimpay.icon || '📁'}</span>
                            <span class="truncate max-w-[120px] md:max-w-[200px]">{currentKimpay.name}</span>
                        </div>
                     </div>
                     <ChevronDown class="h-3 w-3 text-slate-400 shrink-0" />
                  {:else}
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
                          
                          {#if currentParticipant && currentKimpay}
                              <div class="px-4 pt-3 pb-1 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 mb-2">
                                  <!-- Kimpay Title (Non-clickable Header) -->
                                  <div class="flex items-center gap-2 mb-3 opacity-90">
                                      <span class="text-xl leading-none">{currentKimpay.icon || '📁'}</span>
                                      <h3 class="font-extrabold text-slate-900 dark:text-slate-100 text-sm truncate">{currentKimpay.name}</h3>
                                  </div>

                                  <div class="flex items-center gap-3 pb-3">
                                      <div class="relative group">
                                           <Avatar 
                                               name={currentParticipant.name} 
                                               src={currentParticipant.avatar ? pb.files.getURL(currentParticipant, currentParticipant.avatar) : null}
                                               class="w-12 h-12 text-xl" 
                                           />
                                           {#if !offlineService.isOffline}
                                           <button 
                                              class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                              onclick={() => fileInputRef?.click()}
                                           >
                                               <Camera class="h-5 w-5 text-white" />
                                           </button>
                                           {/if}
                                           <input 
                                              type="file" 
                                              accept="image/*"
                                              multiple
                                              class="hidden" 
                                              bind:this={fileInputRef}
                                              onchange={handleAvatarChange}
                                          />
                                      </div>
                                      <div class="flex-1 min-w-0">
                                          <div class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                              {currentParticipant.name}
                                          </div>
                                          {#if !offlineService.isOffline}
                                          <button 
                                              onclick={openIdentityModal}
                                              class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
                                          >
                                              <RefreshCw class="h-3 w-3" />
                                              {$t('identity.change')} 
                                          </button>
                                          {/if}
                                      </div>
                                  </div>
                                  
                              </div>
                          {/if}

                          <div class="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                              {$t('home.history.title')}
                          </div>
                          
                          {#if recentsService.recentKimpays.length === 0}
                              <div class="px-4 py-3 text-sm text-slate-500 italic text-center">
                                  {$t('expense.list.empty.title')}
                              </div>
                          {:else}
                              {@const filteredKimpays = recentsService.recentKimpays.filter(k => k.id !== currentKimpay?.id)}
                              {#each filteredKimpays as k (k.id)}

                                  <a 
                                      href="/k/{k.id}" 
                                      data-sveltekit-preload-data="off"
                                      class="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                  >
                                      <span class="text-xl">{k.icon || "📁"}</span>
                                      <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{k.name}</span>
                                  </a>
                              {/each}
                              {#if filteredKimpays.length === 0}
                                  <div class="px-4 py-3 text-sm text-slate-500 italic text-center">
                                      {$t('expense.list.empty.title')}
                                  </div>
                              {/if}
                          {/if}


                          

                          {#if !offlineService.isOffline}
                          <a 
                              href="/"
                              class="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-indigo-600 dark:text-indigo-400"
                          >
                              <Plus class="h-4 w-4" />
                              <span class="text-sm font-semibold">{$t('home.create.title')}</span>
                          </a>
                          {/if}
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
                                  <span>Theme</span>
                              </div>
                              <span class="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded text-slate-500">
                                  {$theme === 'dark' ? 'Dark' : 'Light'}
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
                                      <span>Language</span>
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
                                  </div>
                              {/if}
                          </div>
                      </div>
                   </div>
              {/if}
          </div>
      </div>
  </div>
</header>

<OfflineHelpModal isOpen={showOfflineHelp} onClose={() => showOfflineHelp = false} />
