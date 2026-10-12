<script lang="ts">
    import { Button } from "#lib/components/ui/button/index.js";
    import { Input } from "#lib/components/ui/input/index.js";
    import { Label } from "#lib/components/ui/label/index.js";
    import { Plus, X, ChevronDown } from "@lucide/svelte";
    import { slide } from 'svelte/transition';
    import { t, locale } from '#lib/i18n.js';
    import { DEFAULT_KIMPAY_EMOJI, NAME_MAX_LENGTH } from '#lib/constants.js';
    import FieldError from '#lib/components/ui/FieldError.svelte';
    import EmojiInput from '#lib/components/ui/EmojiInput.svelte';
    import { recentsStore } from '#lib/stores/recents.svelte.js';
    import { storageService } from '#lib/services/storage.js';
    import { kimpayService } from '#lib/services/kimpay.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { pb } from '#lib/pocketbase.js';
    import { goto } from '$app/navigation';
    import { isValidEmail } from '#lib/utils/index.js';
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
    let emailError = $state("");
    let isLoading = $state(false);
    // Email and other participants are optional: folded by default.
    let isMoreOpen = $state(false);


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
            emailError = $t('error.email.invalid.message');
            return;
        }

        isLoading = true;
        try {
            const { id: kimpayId, creatorId } = await kimpayService.create(
                kimpayName,
                kimpayIcon,
                creatorName,
                otherParticipants,
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
            toasts.error(getErrorMessage(e, $t));
        } finally {
            isLoading = false;
        }
    }

     </script>

<div class="space-y-4">
    <div class="space-y-2">
        <Label for="groupName">{$t('home.create.name_label')}</Label>
        <div class="flex gap-2">
            <EmojiInput variant="kimpay" bind:value={kimpayIcon} />
            <Input id="groupName" bind:value={kimpayName} placeholder={$t('home.create.name_placeholder')} />
            <CurrencySelect bind:value={selectedCurrency} triggerClass="h-11 shrink-0 gap-1 px-3" />
        </div>
    </div>

    <div class="space-y-2">
        <Label for="myName">{$t('home.create.my_name_label')}</Label>
        <Input id="myName" bind:value={creatorName} maxlength={NAME_MAX_LENGTH} placeholder={$t('home.create.my_name_placeholder')} />
    </div>

    <button
        type="button"
        onclick={() => isMoreOpen = !isMoreOpen}
        aria-expanded={isMoreOpen}
        class="flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary"
    >
        <ChevronDown class="h-4 w-4 transition-transform {isMoreOpen ? 'rotate-180' : ''}" />
        {auth.user ? $t('home.create.more_participants') : $t('home.create.more_options')}
    </button>

    {#if isMoreOpen}
        <div class="space-y-4" transition:slide={{ duration: 150 }}>
            {#if !auth.user}
                <div class="space-y-2">
                    <Label for="creatorEmail">{$t('home.create.email_label')}</Label>
                    <Input
                        id="creatorEmail"
                        type="email"
                        bind:value={creatorEmail}
                        oninput={() => emailError = ""}
                        aria-invalid={!!emailError}
                        class={emailError ? 'border-destructive focus-visible:ring-destructive' : ''}
                        placeholder={$t('home.create.email_placeholder')}
                    />
                    <FieldError message={emailError} />
                    <button
                        type="button"
                        onclick={() => isEmailHelpOpen = true}
                        class="flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                        <Info class="h-3.5 w-3.5" />
                        <span class="underline underline-offset-2">{$t('email_help.modal.title')}</span>
                    </button>
                </div>
            {/if}

            <div class="space-y-2">
                <Label for="newParticipant">{$t('home.create.participants_label')}</Label>
                <div class="flex gap-2">
                    <Input
                        id="newParticipant"
                        bind:value={newParticipantName}
                        maxlength={NAME_MAX_LENGTH}
                        placeholder={$t('home.create.participants_placeholder')}
                        onkeydown={(e) => e.key === 'Enter' && addParticipant()}
                    />
                    <Button variant="outline" size="icon" onclick={addParticipant} disabled={!newParticipantName.trim()} aria-label={$t('home.create.participants_placeholder')}>
                        <Plus />
                    </Button>
                </div>

                {#if otherParticipants.length > 0}
                    <div class="flex flex-wrap gap-2">
                        {#each otherParticipants as p, i (p)}
                            <span class="flex h-8 items-center gap-1 rounded-full bg-muted pl-3 pr-1 text-sm">
                                {p}
                                <button type="button" onclick={() => removeParticipant(i)} class="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive" aria-label={$t('home.create.remove_participant')}>
                                    <X class="h-3.5 w-3.5" />
                                </button>
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <Button onclick={create} class="w-full" size="lg" loading={isLoading} disabled={!kimpayName || !creatorName}>
        {isLoading ? $t('home.create.loading') : $t('home.create.button')}
    </Button>
</div>

<EmailHelpModal isOpen={isEmailHelpOpen} onClose={() => isEmailHelpOpen = false} />
