<script lang="ts">
    import { Button } from "#lib/components/ui/button/index.js";
    import { Input } from "#lib/components/ui/input/index.js";
    import { Label } from "#lib/components/ui/label/index.js";
    import { Info, Mail, Sparkles } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import type { TranslationKey } from '#lib/locales/en.js';
    import { DEFAULT_KIMPAY_EMOJI, GROUP_NAME_MAX_LENGTH, NAME_MAX_LENGTH } from '#lib/constants.js';
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
    import { guessCurrency } from '#lib/services/currency.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { haptic } from '#lib/utils/haptic.js';
    import { getErrorMessage } from '#lib/utils/errors.js';

    let kimpayName = $state("");
    let kimpayIcon = $state(DEFAULT_KIMPAY_EMOJI);
    // Not asked here (changed later in the group's settings): the account's,
    // or the one of the browser's country.
    const currency = auth.user?.preferred_currency || guessCurrency();
    let creatorName = $state("");
    let creatorEmail = $state("");
    let isEmailHelpOpen = $state(false);
    let emailError = $state("");
    let isLoading = $state(false);

    let nameInput = $state<HTMLInputElement | null>(null);
    let firstNameInput = $state<HTMLInputElement | null>(null);

    // A name in one tap: each suggestion writes its word and its emoji, the
    // field lights up to show where they went.
    const ideas: { emoji: string; key: TranslationKey }[] = [
        { emoji: '🏖️', key: 'home.idea.holidays' },
        { emoji: '⛺', key: 'home.idea.weekend' },
        { emoji: '🏠', key: 'home.idea.flatshare' },
        { emoji: '🍽️', key: 'home.idea.restaurant' },
        { emoji: '🎉', key: 'home.idea.party' },
        { emoji: '🚗', key: 'home.idea.roadtrip' },
    ];
    let filledFlash = $state(false);
    let flashTimer: ReturnType<typeof setTimeout> | undefined;

    function suggest(emoji: string, name: string) {
        kimpayName = name;
        kimpayIcon = emoji;
        haptic('light');
        // Restarted on each tap.
        filledFlash = false;
        clearTimeout(flashTimer);
        requestAnimationFrame(() => {
            filledFlash = true;
            flashTimer = setTimeout(() => (filledFlash = false), 700);
        });
    }

    $effect(() => {
        if (auth.user && !creatorName && !creatorEmail) {
            creatorName = auth.user.name;
            creatorEmail = auth.user.email;
        }
    });

    // What is left to fill in, said under the button (which stays lit).
    let missing = $derived(
        [
            kimpayName.trim() ? null : $t('home.create.missing_name'),
            creatorName.trim() ? null : $t('home.create.missing_first_name'),
        ].filter(Boolean).join(', ')
    );

    async function create() {
        if (missing) {
            haptic('error');
            (kimpayName.trim() ? firstNameInput : nameInput)?.focus();
            return;
        }

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
                [],
                currency
            );

            // Client side state - update immediately
            storageService.setMyParticipantId(kimpayId, creatorId);
            recentsStore.addRecentKimpay({
                id: kimpayId,
                name: kimpayName,
                icon: kimpayIcon,
                created_by: creatorId
            });

            haptic('success');
            toasts.success($t('toast.kimpay_created'));
            // Opened at once; its emoji jumps in the header on arrival.
            await goto(`/k/${kimpayId}`, { state: { justCreated: true } });

            // Fire-and-forget: Send email in background AFTER navigation
            if (creatorEmail && creatorEmail.trim() && !offlineStore.isOffline) {
                const kimpayUrl = `${window.location.origin}/k/${kimpayId}`;
                const emailData = {
                    email: creatorEmail,
                    url: kimpayUrl,
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
            <Input
                id="groupName"
                bind:ref={nameInput}
                bind:value={kimpayName}
                maxlength={GROUP_NAME_MAX_LENGTH}
                placeholder={$t('home.create.name_placeholder')}
                class={filledFlash ? 'animate-field-filled' : ''}
            />
        </div>
        <!-- Ready-made names for this field, not a step: under it, in a tidy grid. -->
        <div class="space-y-1.5 pt-0.5">
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles class="h-3 w-3" />
                {$t('home.create.suggest_label')}
            </p>
            <div class="grid grid-cols-3 gap-1.5" role="group" aria-label={$t('home.create.suggestions')}>
                {#each ideas as idea (idea.key)}
                    {@const name = $t(idea.key)}
                    {@const chosen = kimpayName === name && kimpayIcon === idea.emoji}
                    <button
                        type="button"
                        onclick={() => suggest(idea.emoji, name)}
                        aria-pressed={chosen}
                        class="flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-control border px-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring {chosen ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-dashed border-input hover:bg-muted'}"
                    >
                        <span aria-hidden="true">{idea.emoji}</span>
                        <span class="truncate">{name}</span>
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <div class="space-y-2">
        <Label for="myName">{$t('home.create.first_name_label')}</Label>
        <Input id="myName" bind:ref={firstNameInput} bind:value={creatorName} maxlength={NAME_MAX_LENGTH} placeholder={$t('home.create.my_name_placeholder')} />
    </div>

    {#if !auth.user}
        <!-- Optional, but said what it is for: the group on any device. -->
        <div class="space-y-2 rounded-card bg-primary-soft p-3">
            <div class="flex items-center justify-between gap-2">
                <Label for="creatorEmail" class="text-foreground">{$t('home.create.email_title')}</Label>
                <span class="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-primary-soft-foreground">{$t('home.create.optional')}</span>
            </div>
            <div class="relative">
                <Mail class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    id="creatorEmail"
                    type="email"
                    bind:value={creatorEmail}
                    oninput={() => emailError = ""}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? 'creatorEmail-error' : 'creatorEmail-hint'}
                    class="pl-9 {emailError ? 'border-destructive focus-visible:ring-destructive' : 'border-transparent'}"
                    placeholder={$t('home.create.email_placeholder')}
                />
            </div>
            <FieldError id="creatorEmail-error" message={emailError} />
            <p id="creatorEmail-hint" class="text-xs text-muted-foreground">
                {$t('home.create.email_hint')}
                <button
                    type="button"
                    onclick={() => isEmailHelpOpen = true}
                    class="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                    <Info class="h-3 w-3" />
                    {$t('email_help.modal.title')}
                </button>
            </p>
        </div>
    {/if}

    <div class="space-y-1.5">
        <Button onclick={create} class="w-full" size="lg" loading={isLoading} aria-describedby={missing ? 'create-missing' : undefined}>
            {isLoading ? $t('home.create.loading') : $t('home.create.button')}
        </Button>
        <p id="create-missing" class="min-h-5 text-center text-sm text-muted-foreground" aria-live="polite">
            {#if missing}{$t('expense.form.missing', { fields: missing })}{/if}
        </p>
    </div>
</div>

<EmailHelpModal isOpen={isEmailHelpOpen} onClose={() => isEmailHelpOpen = false} />
