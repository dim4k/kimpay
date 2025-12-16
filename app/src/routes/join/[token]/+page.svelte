<script lang="ts">
  import { page } from '$app/state';
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { pb } from '$lib/pocketbase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { LoaderCircle, ArrowRight, CloudOff } from "lucide-svelte";
  import { generateUUID } from '$lib/utils';
  import type { Kimpay, Participant } from '$lib/types';
  import { storageService } from '$lib/services/storage';
  import { auth } from '$lib/stores/auth.svelte';
  import { participantService } from '$lib/services/participant';
  import { offlineService } from '$lib/services/offline.svelte';
  import { t } from '$lib/i18n';

  let token = $derived(page.params.token);
  let name = $state("");
  let isLoading = $state(false);
  let kimpay = $state<Kimpay | null>(null);
  let participants = $state<Participant[]>([]);
  let error = $state("");

  let isOfflineBlocked = $derived(offlineService.isOffline && !kimpay);

  onMount(async () => {
    // Block if offline - can't join without network
    if (offlineService.isOffline) {
      return;
    }

    try {
      // Use secure endpoint to resolve token (bypassing collection restrictions)
      const data = await pb.send(`/api/invite/${token}`, {});
      
      kimpay = {
          id: data.id,
          name: data.name,
          icon: data.icon,
          collectionId: 'kimpays',
          collectionName: 'kimpays',
          created: '',
          updated: '',
          invite_token: token // Assume valid since we are here
      } as Kimpay;
      
      // Participants returned by API
      participants = data.participants || [];
      
      // Sort manually since check
      participants.sort((a: Participant, b: Participant) => new Date(a.created).getTime() - new Date(b.created).getTime());

      // Auto-join if already known
      const storedId = storageService.getMyParticipantId(kimpay!.id);
      
      if (storedId) {
          // Verify match (ID or Local ID)
          const me = participants.find(p => p.id === storedId || p.local_id === storedId);
          if (me) await goto(`/k/${kimpay!.id}`);
      }

    } catch (_e) {
      error = "Invalid or expired invite link.";
    }
  });

  async function persistAndRedirect(participant: Participant) {
      // Use Record ID as primary identity, handling legacy check via checking p.id
      storageService.setMyParticipantId(kimpay!.id, participant.id);
      await goto(`/k/${kimpay!.id}`);
  }

  async function joinGroup() {
    if (!name || !kimpay) return;
    isLoading = true;
    try {
        const local_id = generateUUID();
        const participant = await participantService.create(kimpay.id, name, local_id, auth.user?.id);
        
        await persistAndRedirect(participant);
    } catch (e) {
        console.error(e);
        error = "Failed to join. Try again.";
        isLoading = false;
    }
  }

  async function claimParticipant(p: Participant) {
      isLoading = true;
      try {
          let updated: Participant;
          
          if (auth.user) {
              updated = await participantService.claim(p.id, kimpay!.id, auth.user.id);
          } else {
              // Guest mode: use local_id to "claim" ownership on this device
              const local_id = generateUUID();
              updated = await pb.collection('participants').update<Participant>(p.id, {
                  local_id: local_id
              });
          }
          
          await persistAndRedirect(updated);
      } catch (e) {
         console.error(e);
         error = "Failed to claim profile.";
         isLoading = false;
      }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
  <div class="w-full max-w-md space-y-8 bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border dark:border-slate-800 transition-colors">
    {#if isOfflineBlocked}
        <!-- Offline state -->
        <div class="text-center space-y-6">
            <div class="h-20 w-20 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <CloudOff class="h-10 w-10 text-slate-400" />
            </div>
            <div class="space-y-2">
                <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">{$t('join.offline.title')}</h2>
                <p class="text-slate-500 dark:text-slate-400">{$t('join.offline.desc')}</p>
            </div>
            <Button variant="outline" href="/" class="w-full">{$t('common.back_home')}</Button>
        </div>
    {:else if error}
        <div class="text-center space-y-4">
            <div class="text-red-500 font-medium">{error}</div>
            <Button variant="outline" href="/">Go Home</Button>
        </div>
    {:else if kimpay}
        <div class="text-center space-y-2">
            <h1 class="text-2xl font-bold">Join "{kimpay.name}"</h1>
            <p class="text-muted-foreground">Select your profile or create a new one.</p>
        </div>
        
        <div class="space-y-6 pt-4">
            
            {#if participants.length > 0}
                <div class="space-y-3">
                    <Label class="text-xs uppercase text-muted-foreground">Existing Profiles</Label>
                    <div class="grid gap-2">
                        {#each participants as p (p.id)}
                             {@const isLocked = !!p.user && p.user !== auth.user?.id}
                             {@const isMe = !!p.user && p.user === auth.user?.id}
                             <button 
                                onclick={() => claimParticipant(p)}
                                class="flex w-full items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading || isLocked}
                             >
                                <div class="flex items-center gap-2">
                                     <span class="font-medium {isLocked ? 'text-muted-foreground' : ''}">{p.name}</span>
                                     {#if isLocked}
                                         <span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border">Locked</span>
                                     {/if}
                                     {#if isMe}
                                         <span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">Current</span>
                                     {/if}
                                </div>
                                
                                {#if !isLocked && !isMe}
                                    <span class="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        {auth.user ? 'Switch to this' : "It's Me"} <ArrowRight class="h-3 w-3" />
                                    </span>
                                {/if}
                             </button>
                        {/each}
                    </div>
                </div>
                
                <div class="relative py-2">
                    <div class="absolute inset-0 flex items-center">
                    <span class="w-full border-t"></span>
                    </div>
                    <div class="relative flex justify-center text-xs uppercase">
                    <span class="bg-white px-2 text-muted-foreground">Or create new</span>
                    </div>
                </div>
            {/if}

            <div class="space-y-2">
                <Label>Your Name</Label>
                <div class="flex gap-2">
                    <Input bind:value={name} placeholder="e.g. Antoine" />
                    <Button onclick={joinGroup} disabled={!name || isLoading}>
                        {isLoading ? '...' : (participants.length > 0 ? 'Create' : 'Join')}
                    </Button>
                </div>
            </div>

        </div>
    {:else}
        <div class="flex justify-center p-8">
            <LoaderCircle class="h-6 w-6 animate-spin text-slate-400" />
        </div>
    {/if}
  </div>
</div>
