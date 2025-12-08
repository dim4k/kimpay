<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { createKimpay } from '$lib/api';
  import { pb } from '$lib/pocketbase';
  import { goto } from '$app/navigation';
  import { Plus, X, Loader2, History, ArrowRight, LogOut, Languages, QrCode } from "lucide-svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import Background from '$lib/components/ui/Background.svelte';
  import { t, locale } from '$lib/i18n';
  import { KIMPAY_EMOJIS, DEFAULT_KIMPAY_EMOJI } from '$lib/constants';
  import ScannerModal from "$lib/components/ui/ScannerModal.svelte";

  import { appState } from '$lib/stores/appState.svelte';

  let code = $state("");
  let joinError = $state("");
  let isLoading = $state(false);
  let isEmojiPickerOpen = $state(false);

  // Leave/Delete State
  let kimpayToLeave = $state<string | null>(null);
  let isLeaving = $state(false);
  
  // Fast check for initial render to avoid flash if possible
  import { browser } from '$app/environment';
  let showHero = $state(false);
  
  // Creation State
  let kimpayName = $state("");
  let kimpayIcon = $state(DEFAULT_KIMPAY_EMOJI); // Default icon
  let creatorName = $state("");
  let newParticipantName = $state("");
  let otherParticipants = $state<string[]>([]);
  let creatorEmail = $state("");
  
  // Removed local state: recentKimpays, loadingHistory
  // We use store: recentKimpays.items, recentKimpays.loading (optional)

  // Determine if we should show hero based on store
  $effect(() => {
      if (appState.initializedRecentKimpays) {
          showHero = appState.recentKimpays.length === 0;
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
      appState.initRecentKimpays();
  });

  async function join() {
    if (!code) return;
    isLoading = true;
    joinError = "";
    
    try {
        // Validate existence first
        // Simple cleanup if full url pasted
        const cleanCode = code.includes('/k/') ? code.split('/k/')[1].split('/')[0] : code;
        await pb.collection('kimpays').getOne(cleanCode);
        goto(`/k/${cleanCode}`); 
    } catch (e) {
        joinError = $t('home.join.error_not_found');
    } finally {
        isLoading = false;
    }
  }
  
  // Scanner Logic
  let isScannerOpen = $state(false);

  function handleScan(decodedText: string) {
      if (!decodedText) return;
      
      let foundId = "";
      
      // 1. Try URL Regex
      // Matches .../k/RECORDID...
      const urlMatch = decodedText.match(/\/k\/([a-zA-Z0-9]{15})/);
      if (urlMatch && urlMatch[1]) {
          foundId = urlMatch[1];
      } 
      // 2. Check if raw ID (PocketBase standard: 15 chars alphanumeric)
      else if (/^[a-zA-Z0-9]{15}$/.test(decodedText)) {
          foundId = decodedText;
      }

      if (foundId) {
          code = foundId;
          isScannerOpen = false;
          join(); // Auto join
      } else {
          // Feedback could be improved, but for now just close and fill text
          alert("QR Code invalide ou lien Kimpay non reconnu.");
          isScannerOpen = false;
      }
  }

  function addParticipant() {
    if (newParticipantName.trim()) {
      otherParticipants = [...otherParticipants, newParticipantName.trim()];
      newParticipantName = "";
    }
  }

  function removeParticipant(index: number) {
    otherParticipants = otherParticipants.filter((_, i) => i !== index);
  }

  async function create() {
    if (!kimpayName.trim() || !creatorName.trim()) return;
    
    isLoading = true;
    try {
      const record = await createKimpay(kimpayName, kimpayIcon, creatorName, otherParticipants);
      
      // Update store immediately
      appState.addRecentKimpay(record);
      
      if (creatorEmail && creatorEmail.trim()) {
        const kimpayUrl = `${window.location.origin}/k/${record.id}`;
        
        pb.send("/api/kimpay/share", {
            method: "POST",
            body: {
                email: creatorEmail,
                url: kimpayUrl,
                kimpayName: kimpayName,
                locale: $locale
            }
        }).catch(err => console.error("Erreur envoi mail:", err));
      }

      goto(`/k/${record.id}`);
    } catch (e) {
      alert("Error creating Kimpay");
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  function requestLeave(id: string, event: Event) {
      event.preventDefault();
      event.stopPropagation();
      kimpayToLeave = id;
  }

  async function confirmLeave() {
      if (!kimpayToLeave) return;
      isLeaving = true;
      try {
          const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
          const participantId = myKimpays[kimpayToLeave];
          const kimpay = appState.recentKimpays.find(k => k.id === kimpayToLeave);

          if (participantId) {
             let canDelete = true;

             // 1. Check if Creator
             if (kimpay && kimpay.created_by === participantId) {
                 canDelete = false;
             }

             // 2. Check if involved in expenses (only if not already blocked)
             if (canDelete) {
                 try {
                    const res = await pb.collection('kimpays').getOne(kimpayToLeave, {
                        expand: 'expenses_via_kimpay'
                    });
                    const allExpenses = res.expand ? (res.expand['expenses_via_kimpay'] || []) : [];
                    const isUsed = allExpenses.some((e: any) => e.payer === participantId || (e.involved && e.involved.includes(participantId)));
                    
                    if (isUsed) {
                        canDelete = false;
                    }
                 } catch (e) {
                     console.warn("Could not check expenses", e);
                     canDelete = false; // Safe fallback
                 }
             }

             if (canDelete) {
                try {
                    await pb.collection('participants').delete(participantId);
                } catch(e) {
                    console.warn("Could not delete participant from server (likely constraint)", e);
                }
             }
          }
          
          delete myKimpays[kimpayToLeave];
          localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));
          localStorage.removeItem(`kimpay_user_${kimpayToLeave}`); // Add cleanup here to prevent re-adding on refresh

          appState.removeRecentKimpay(kimpayToLeave);
          kimpayToLeave = null;

      } catch (e) {
          console.error("Error leaving kimpay", e);
          alert("Error leaving group");
      } finally {
          isLeaving = false;
      }
  }

</script>


<!-- Background Blobs & Icons -->
<!-- Background -->
<Background />

<div class="relative z-10 flex flex-col items-center p-4 pb-4 w-full max-w-md mx-auto mt-4 md:mt-8">

    {#if showHero}
        <div class="text-center space-y-2 md:space-y-4 mb-6 md:mb-10 animate-slide-up">
            <!-- Hero Logo (Larger) -->
            <div class="inline-flex items-center justify-center p-4 md:p-6 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-indigo-100 dark:shadow-none mb-2 md:mb-4 transition-all duration-500 hover:scale-105">
                <Logo class="w-12 h-12 md:w-20 md:h-20 text-indigo-700 dark:text-indigo-400" />
            </div>
            <h1 class="text-2xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">{$t('app.name')}</h1>
            <p class="text-sm md:text-lg text-muted-foreground max-w-[280px] mx-auto leading-relaxed">{$t('app.slogan')}</p>
        </div>
    {/if}
    
    <div class="bg-card p-4 md:p-6 rounded-2xl shadow-sm border space-y-4 md:space-y-6 w-full transition-colors animate-pop-in" style="animation-delay: 150ms;">
        <div class="space-y-3 md:space-y-4">
            <h2 class="font-semibold text-lg flex items-center gap-2">
                <div class="w-1 h-6 bg-primary rounded-full"></div>
                {$t('home.create.title')}
            </h2>
            
            <div class="space-y-4">
                <div class="space-y-2">
                    <Label for="groupName">{$t('home.create.name_label')}</Label>
                    <div class="flex gap-2">
                        <div class="relative">
                            <Input 
                                class="w-14 text-center text-xl p-0 cursor-pointer selection:bg-transparent" 
                                value={kimpayIcon} 
                                readonly 
                                onclick={() => isEmojiPickerOpen = !isEmojiPickerOpen} 
                                aria-label="Group Icon"
                            />
                            
                            {#if isEmojiPickerOpen}
                                <div class="absolute top-full mt-2 left-0 z-50 w-64 bg-white dark:bg-slate-900 rounded-lg shadow-xl border dark:border-slate-800 p-2 grid grid-cols-5 gap-2" transition:fade={{ duration: 100 }}>
                                    {#each KIMPAY_EMOJIS as emoji}
                                        <button 
                                            class="aspect-square hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-xl flex items-center justify-center transition-colors"
                                            onclick={() => {
                                                kimpayIcon = emoji;
                                                isEmojiPickerOpen = false;
                                            }}
                                        >
                                            {emoji}
                                        </button>
                                    {/each}
                                </div>
                                <div 
                                    class="fixed inset-0 z-40" 
                                    onclick={() => isEmojiPickerOpen = false} 
                                    role="button" 
                                    tabindex="-1" 
                                    onkeydown={(e) => e.key === 'Escape' && (isEmojiPickerOpen = false)}
                                ></div>
                            {/if}
                        </div>
                        <Input id="groupName" bind:value={kimpayName} placeholder={$t('home.create.name_placeholder')} />
                    </div>
                </div>
            </div>

            <div class="space-y-2">
                <Label for="myName">{$t('home.create.my_name_label')}</Label>
                <Input id="myName" bind:value={creatorName} placeholder={$t('home.create.my_name_placeholder')} />
            </div>

            <div class="space-y-2">
                <Label for="creatorEmail">{$t('home.create.email_label')}</Label>
                <Input 
                    id="creatorEmail" 
                    type="email" 
                    bind:value={creatorEmail} 
                    placeholder={$t('home.create.email_placeholder')} 
                />
                <p class="text-xs text-muted-foreground">
                    {$t('home.create.email_help')}
                </p>
            </div>

            <div class="space-y-2">
                <Label>{$t('home.create.participants_label')}</Label>
                <div class="flex gap-2">
                    <Input 
                        bind:value={newParticipantName} 
                        placeholder={$t('home.create.participants_placeholder')} 
                        onkeydown={(e) => e.key === 'Enter' && addParticipant()}
                    />
                    <Button variant="outline" size="icon" onclick={addParticipant} disabled={!newParticipantName.trim()} aria-label={$t('home.create.participants_placeholder')}>
                        <Plus class="h-4 w-4" />
                    </Button>
                </div>
                
                {#if otherParticipants.length > 0}
                    <div class="flex flex-wrap gap-2 mt-2">
                        {#each otherParticipants as p, i}
                            <div class="bg-slate-100 dark:bg-slate-800 text-sm px-3 py-1 rounded-full flex items-center gap-1 group transition-colors">
                                {p}
                                <button onclick={() => removeParticipant(i)} class="text-muted-foreground hover:text-red-500" aria-label="Remove participant">
                                    <X class="h-3 w-3" />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <Button onclick={create} class="w-full" size="lg" disabled={isLoading || !kimpayName || !creatorName}>
                {#if isLoading}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    {$t('home.create.loading')}
                {:else}
                    {$t('home.create.button')}
                {/if}
            </Button>
        </div>

      
        <div class="relative py-4">
            <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t border-slate-100"></span>
            </div>
            <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-card px-3 text-muted-foreground font-medium transition-colors">{$t('home.join.title')}</span>
            </div>
        </div>

        <div class="flex flex-col gap-2">
            <div class="flex gap-2">
                <Input 
                    bind:value={code} 
                    placeholder={$t('home.join.placeholder')} 
                    class="text-center font-bold uppercase placeholder:font-normal {joinError ? 'border-red-500 ring-red-500' : ''}" 
                    oninput={() => joinError = ""}
                    onkeydown={(e) => e.key === 'Enter' && join()}
                />
                
                <Button onclick={join} variant="secondary" disabled={isLoading}>
                    {#if isLoading}
                        <Loader2 class="h-4 w-4 animate-spin" />
                    {:else}
                        {$t('home.join.button')}
                    {/if}
                </Button>

                <!-- Mobile Scan Button -->
                <Button 
                  variant="outline"
                  size="icon"
                  class="md:hidden aspect-square shrink-0"
                  onclick={() => isScannerOpen = true}
                  aria-label="Scan QR Code"
                >
                   <QrCode class="h-4 w-4" />
                </Button>
            </div>
            {#if joinError}
                <p class="text-xs text-red-500 text-center font-medium animate-pulse" transition:fade>{joinError}</p>
            {/if}
        </div>
    </div>

    <!-- History Section -->
    {#if !appState.loadingRecentKimpays && appState.recentKimpays.length > 0}
        <div class="w-full pt-8 pb-8" transition:fade>
            <div class="flex items-center py-6">
                <div class="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span class="px-4 text-xs uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
                    <History class="h-4 w-4" />
                    {$t('home.history.title')}
                </span>
                <div class="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            
            <div class="grid gap-3">
                {#each appState.recentKimpays as k}
                    <a href="/k/{k.id}" data-sveltekit-preload-data="off" class="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/20 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all duration-300 group">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">{k.icon || "📁"}</span>
                            <span class="font-medium text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">{k.name}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button 
                                class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                onclick={(e) => requestLeave(k.id, e)}
                                title={$t('home.history.leave_tooltip')}
                                aria-label={$t('home.history.leave_tooltip')}
                            >
                                <LogOut class="h-4 w-4" />
                            </button>
                            <ArrowRight class="h-4 w-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </div>
                    </a>
                {/each}
            </div>
        </div>
    {/if}
  
  <ConfirmModal 
      isOpen={!!kimpayToLeave}
      title={$t('modal.leave.title')}
      description={$t('modal.leave.desc')}
      confirmText={$t('modal.leave.confirm')}
      variant="destructive"
      isProcessing={isLeaving}
      onConfirm={confirmLeave}
      onCancel={() => kimpayToLeave = null}
  />

  <ScannerModal 
      isOpen={isScannerOpen} 
      onScan={handleScan} 
      onClose={() => isScannerOpen = false} 
  />
</div>

