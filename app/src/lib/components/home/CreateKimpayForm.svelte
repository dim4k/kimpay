<script lang="ts">
    import { Button } from "#lib/components/ui/button/index.js";
    import { Input } from "#lib/components/ui/input/index.js";
    import { Label } from "#lib/components/ui/label/index.js";
    import { Plus, X, LoaderCircle } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import { DEFAULT_KIMPAY_EMOJI } from '#lib/constants.js';
    import EmojiInput from '#lib/components/ui/EmojiInput.svelte';
    import { recentsStore } from '#lib/stores/recents.svelte.js';
    import { storageService } from '#lib/services/storage.js';
    import { kimpayService } from '#lib/services/kimpay.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { pb } from '#lib/pocketbase.js';
    import { goto } from '$app/navigation';
    import { isValidEmail } from '#lib/utils/index.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import EmailHelpModal from '#lib/components/ui/modals/EmailHelpModal.svelte';
    import { Info } from "@lucide/svelte";
    import { DEFAULT_CURRENCY } from '#lib/services/currency.js';
    import CurrencySelect from '#lib/components/ui/CurrencySelect.svelte';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { haptic } from '#lib/utils/haptic.js';
    import { getErrorMessage } from '#lib/utils/errors.js';

    let kimpayName = $state("");
    let kimpayIcon = $state(DEFAULT_KIMPAY_EMOJI); 
    let selectedCurrency = $state(auth.user?.preferred_currency ?? DEFAULT_CURRENCY);
    let creatorName = $state("");
    let newParticipantName = $state("");
    let otherParticipants = $state<string[]>([]);
    let creatorEmail = $state("");
    let isEmailHelpOpen = $state(false);
    let isLoading = $state(false);


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
                auth.user ? auth.user.id : undefined,
                selectedCurrency
            );

            // Client side state - update immediately
            storageService.setMyParticipantId(kimpayId, creatorId);
            recentsStore.addRecentKimpay({
                id: kimpayId,
                name: kimpayName,
                icon: kimpayIcon,
                created_by: creatorId
            });

            // Navigate IMMEDIATELY - don't wait for email
            haptic('success');
            toasts.success($t('toast.kimpay_created'));
            await goto(`/k/${kimpayId}`);

            // Fire-and-forget: Send email in background AFTER navigation
            if (creatorEmail && creatorEmail.trim() && !offlineStore.isOffline) {
                const kimpayUrl = `${window.location.origin}/k/${kimpayId}`;
                const emailData = {
                    email: creatorEmail,
                    url: kimpayUrl,
                    kimpayName: kimpayName,
                    locale: $locale,
                    creator: creatorName
                };

                // Don't await - fire and forget. The recipient logs in via the
                // magic link in the email; account/participant linking happens
                // then (the share endpoint only sends the email).
                pb.send("/api/kimpay/share", {
                    method: "POST",
                    body: emailData
                }).catch(err => {
                    console.error("Background email error:", err);
                });
            }

        } catch (e: unknown) {
            console.error("Kimpay Creation Error:", e);
            haptic('error');
            modals.alert({
                message: getErrorMessage(e, $t),
                title: $t('error.generic.title')
            });
        } finally {
            isLoading = false;
        }
    }

     
    let { hideTitle = false }: {hideTitle?: boolean} = $props();
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
                <EmojiInput variant="kimpay" bind:value={kimpayIcon} />
                <Input id="groupName" bind:value={kimpayName} placeholder={$t('home.create.name_placeholder')} />
                
                <CurrencySelect bind:value={selectedCurrency} triggerClass="h-10 gap-1 px-2 py-0 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" />
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
        <div class="flex items-center gap-2">
            <button 
                onclick={() => isEmailHelpOpen = true}
                class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
                <Info class="h-3 w-3" />
                <span class="underline underline-offset-2">{$t('email_help.modal.title')}</span>
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
            <div class="flex flex-wrap gap-2">
                {#each otherParticipants as p, i (p)}
                    <div class="bg-slate-100 dark:bg-slate-800 text-sm px-3 py-1 rounded-full flex items-center gap-1 group transition-colors">
                        {p}
                        <button onclick={() => removeParticipant(i)} class="text-muted-foreground hover:text-red-500" aria-label={$t('home.create.remove_participant')}>
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
