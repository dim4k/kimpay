<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Plus, X, LoaderCircle } from "lucide-svelte";
    import { t, locale } from '$lib/i18n';
    import { KIMPAY_EMOJIS, DEFAULT_KIMPAY_EMOJI } from '$lib/constants';
    import { fade } from 'svelte/transition';
    import { recentsService } from '$lib/services/recents.svelte';
    import { storageService } from '$lib/services/storage';
    import { kimpayService } from '$lib/services/kimpay';
    import { offlineService } from '$lib/services/offline.svelte';
    import { pb } from '$lib/pocketbase';
    import { goto } from '$app/navigation';
    import { isValidEmail } from '$lib/utils';
    import { modals } from '$lib/stores/modals.svelte';
    import { auth } from '$lib/stores/auth.svelte';
    import EmailHelpModal from '$lib/components/ui/modals/EmailHelpModal.svelte';
    import { Info } from "lucide-svelte";

    let kimpayName = $state("");
    let kimpayIcon = $state(DEFAULT_KIMPAY_EMOJI); 
    let creatorName = $state("");
    let newParticipantName = $state("");
    let otherParticipants = $state<string[]>([]);
    let creatorEmail = $state("");
    let isEmojiPickerOpen = $state(false);
    let isEmailHelpOpen = $state(false);
    let isLoading = $state(false);
    
    let createdKimpayUrl = $state("");

    $effect(() => {
        if (auth.user && !creatorName && !creatorEmail) {
            creatorName = auth.user.name;
            creatorEmail = auth.user.email;
        }
    });

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
        
        if (creatorEmail && creatorEmail.trim() && !isValidEmail(creatorEmail.trim())) {
            modals.alert({ 
                message: $t('error.email.invalid.message'), 
                title: $t('error.email.invalid.title') 
            });
            return;
        }

        isLoading = true;
        try {
            const { id: kimpayId, creatorId } = await kimpayService.create(
                kimpayName,
                kimpayIcon,
                creatorName,
                otherParticipants,
                auth.user ? auth.user.id : undefined
            );

            // Update store logic is now handled in kimpayStore (optimistic)
            // But we need to update recentsService for immediate feedback if not handled by store?
            // kimpayStore.create updates offline queue but does it update Recents?
            // Recents service listens to storage? or needs manual add?
            // The original code did: recentsService.addRecentKimpay(...); storageService.setMyParticipantId(...);
            
            // We should ensure kimpayStore.create or this caller handles "Recents" + "MyIdentity"
            // kimpayStore.create handles offline queue for server sync.
            // Client side state:
            storageService.setMyParticipantId(kimpayId, creatorId);
            recentsService.addRecentKimpay({
                id: kimpayId,
                name: kimpayName,
                icon: kimpayIcon,
                created_by: creatorId
            });
            storageService.setMyParticipantId(kimpayId, creatorId);

            
            let shouldRedirect = true;
            if (creatorEmail && creatorEmail.trim()) {
                const kimpayUrl = `${window.location.origin}/k/${kimpayId}`;
                
                try {
                    // This part should technically also be offline-capable or queued if important? 
                    // Email sending requires server.
                    // If offline, we can't send email.
                    // We should check offline status.
                     if (offlineService.isOffline) {
                         // Queue basic "Send Email" action? Or just warn?
                         // For now, let's just skip email if offline or warn.
                         // Or try/catch and ignore.
                     } else {
                        const res = await pb.send("/api/kimpay/share", {
                            method: "POST",
                            body: {
                                email: creatorEmail,
                                url: kimpayUrl,
                                kimpayName: kimpayName,
                                locale: $locale,
                                creator: creatorName,
                                participantId: creatorId // Trigger magic link creation
                            }
                        });
                        
                        const isMyOwnEmail = auth.user && auth.user.email === creatorEmail;
                        
                        if (res && res.isNewUser === false && !isMyOwnEmail) { 
                            shouldRedirect = false;
                            
                            // Cleanup: Allow logic to think creation failed for this user
                            recentsService.removeRecentKimpay(kimpayId);
                            storageService.removeRecentKimpay(kimpayId);
    
                            createdKimpayUrl = `/`; 
                            modals.alert({
                                title: $t('home.create.existing_user_modal.title'),
                                message: $t('home.create.existing_user_modal.message'),
                                variant: 'info',
                                onConfirm: () => goto(createdKimpayUrl)
                            });
                        }
                     }
                } catch (err) {
                    console.error("Erreur envoi mail:", err);
                }
            }

            if (shouldRedirect) {
                await goto(`/k/${kimpayId}`);
            }
        } catch (e: unknown) {
            console.error("Kimpay Creation Error:", e);
            // Alert the specific validation errors from PocketBase
            const err = e as { response?: { data?: unknown }, message?: string };
            if (err.response && err.response.data) {
                modals.alert({ 
                    message: JSON.stringify(err.response.data, null, 2), 
                    title: "Error" 
                });
            } else {
                modals.alert({ 
                    message: "Error creating Kimpay: " + (err.message || String(e)), 
                    title: "Error" 
                });
            }
        } finally {
            isLoading = false;
        }
    }
     
    let { hideTitle = false } = $props<{hideTitle?: boolean}>();
</script>

<div class="space-y-3 md:space-y-4">
    {#if !hideTitle}
    <h2 class="font-semibold text-lg flex items-center gap-2">
        <div class="w-1 h-6 bg-primary rounded-full"></div>
        {$t('home.create.title')}
    </h2>
    {/if}
    
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
                            {#each KIMPAY_EMOJIS as emoji (emoji)}
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

    {#if !auth.user}
    <div class="space-y-2">
        <Label for="creatorEmail">{$t('home.create.email_label')}</Label>
        <Input 
            id="creatorEmail" 
            type="email" 
            bind:value={creatorEmail} 
            placeholder={$t('home.create.email_placeholder')} 
        />
        <div class="flex items-center gap-2 mt-1.5">
            <button 
                onclick={() => isEmailHelpOpen = true}
                class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
                <Info class="h-3 w-3" />
                <span class="underline underline-offset-2">{$t('email_help.modal.title', { default: 'Why your email?' })}</span>
            </button>
        </div>
    </div>
    {/if}

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
                {#each otherParticipants as p, i (p)}
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

<EmailHelpModal isOpen={isEmailHelpOpen} onClose={() => isEmailHelpOpen = false} />
