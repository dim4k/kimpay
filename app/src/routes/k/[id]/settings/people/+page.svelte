<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { pb } from '$lib/pocketbase';
  import { onMount } from 'svelte';
  
  let kimpayId = $derived($page.params.id);
  let participants = $state<any[]>([]);
  let newName = $state("");
  let isLoading = $state(false);

  async function loadPeople() {
    try {
      const res = await pb.collection('kimpays').getOne(kimpayId, {
        expand: 'participants_via_kimpay'
      });
      participants = res.expand ? (res.expand['participants_via_kimpay'] || []) : [];
      participants.sort((a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime());
    } catch (e) {
      console.error(e);
    }
  }

  async function addPerson() {
    if (!newName) return;
    isLoading = true;
    try {
      await pb.collection('participants').create({
        name: newName,
        kimpay: kimpayId
      });
      newName = "";
      await loadPeople();
    } catch (e) {
      alert("Failed to add person");
    } finally {
      isLoading = false;
    }
  }

  async function deletePerson(id: string) {
      if(!confirm("Remove this person?")) return;
      try {
          await pb.collection('participants').delete(id);
          await loadPeople();
      } catch (e) {
          alert("Failed to delete");
      }
  }

  onMount(loadPeople);
</script>

<div class="p-4 space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold">Participants</h2>
  </div>

  <div class="flex gap-2">
    <Input bind:value={newName} placeholder="Add new person..." />
    <Button onclick={addPerson} disabled={isLoading || !newName}>Add</Button>
  </div>

  <div class="space-y-2">
    {#each participants as person}
      <div class="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
        <div class="flex items-center gap-3">
            <div class="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                {person.name.substring(0,2).toUpperCase()}
            </div>
            <span class="font-medium">{person.name}</span>
            {#if person.local_id}
                <span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Device User</span>
            {/if}
        </div>
        <Button variant="ghost" size="sm" class="text-red-500 h-8 w-8 p-0" onclick={() => deletePerson(person.id)}>
             ✕
        </Button>
      </div>
    {/each}
  </div>
</div>
