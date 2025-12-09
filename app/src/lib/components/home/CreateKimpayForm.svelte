<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Plus, X, LoaderCircle } from "lucide-svelte";
    import { t, locale } from '$lib/i18n';
    import { KIMPAY_EMOJIS, DEFAULT_KIMPAY_EMOJI } from '$lib/constants';
    import { fade } from 'svelte/transition';
    import { createKimpay } from '$lib/api';
    import { appState } from '$lib/stores/appState.svelte';
    import { pb } from '$lib/pocketbase';
    import { goto } from '$app/navigation';

    let kimpayName = $state("");
    let kimpayIcon = $state(DEFAULT_KIMPAY_EMOJI); 
    let creatorName = $state("");
    let newParticipantName = $state("");
    let otherParticipants = $state<string[]>([]);
    let creatorEmail = $state("");
    let isEmojiPickerOpen = $state(false);
    let isLoading = $state(false);

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
                        locale: $locale,
                        creator: creatorName
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
</script>

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
            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
            {$t('home.create.loading')}
        {:else}
            {$t('home.create.button')}
        {/if}
    </Button>
</div>
