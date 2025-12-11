<script lang="ts">
  import { page } from '$app/state';
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { pb } from '$lib/pocketbase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { LoaderCircle, ArrowRight } from "lucide-svelte";
  import { generateUUID } from '$lib/utils';
  import type { Kimpay, Participant } from '$lib/types';
  import { storageService } from '$lib/services/storage';

  let token = $derived(page.params.token);
  let name = $state("");
  let isLoading = $state(false);
  let kimpay = $state<Kimpay | null>(null);
  let participants = $state<Participant[]>([]);
  let error = $state("");

  onMount(async () => {
    try {
      kimpay = await pb.collection('kimpays').getFirstListItem<Kimpay>(`invite_token="${token}"`);
      // Fetch open participants (no local_id) that could be claimed
      // Actually, we might want to list ALL, but let's just list ones that look claimable or all for now so user can pick 'Is this you?'
      // For simplicity/security, usually you only list "unclaimed" ones, but we defined "unclaimed" as no local_id or just purely name based?
      // Our schema has local_id. If it's populated, it's "taken" by a device.
      participants = await pb.collection('participants').getFullList<Participant>({
          filter: `kimpay="${kimpay!.id}"`,
          sort: 'created'
      });

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
        const participant = await pb.collection('participants').create<Participant>({
            name,
            kimpay: kimpay.id,
            local_id
        });
        // We generate it but don't strictly need to pass it for persistence now as we use p.id
        
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
          const local_id = generateUUID();
          // Claims the participant by setting the local_id
          // Note: If it already had one, we are overwriting it. 
          // In a "real" app we'd warn, but here "claiming" implies I am this person on this device.
          const updated = await pb.collection('participants').update<Participant>(p.id, {
              local_id: local_id
          });
          
          await persistAndRedirect(updated);
      } catch (e) {
         console.error(e);
         error = "Failed to claim profile.";
         isLoading = false;
      }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
  <div class="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-sm border">
    {#if error}
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
                             <button 
                                onclick={() => claimParticipant(p)}
                                class="flex w-full items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors text-left group"
                                disabled={isLoading}
                             >
                                <span class="font-medium">{p.name}</span>
                                <span class="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    It's Me <ArrowRight class="h-3 w-3" />
                                </span>
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
