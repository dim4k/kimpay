<script lang="ts">
    import { LoaderCircle } from "@lucide/svelte";
    import { t } from '#lib/i18n.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { profileStore, type PaymentHandles } from '#lib/stores/profile.svelte.js';
    import { getErrorMessage } from '#lib/utils/errors.js';
    import { normalizeHandle } from '#lib/utils/payment.js';

    interface Props {
        isOpen: boolean;
        onClose: () => void;
        /** After a successful save (e.g. to then show them in a group) */
        onSaved?: (handles: PaymentHandles) => void | Promise<void>;
    }

    let { isOpen, onClose, onSaved }: Props = $props();

    let paypalInput = $state('');
    let revolutInput = $state('');
    let isSaving = $state(false);

    // Start from the profile each time the sheet opens.
    $effect(() => {
        if (!isOpen) return;
        paypalInput = profileStore.handles.paypal;
        revolutInput = profileStore.handles.revolut;
    });

    async function save() {
        const paypal = normalizeHandle(paypalInput);
        const revolut = normalizeHandle(revolutInput);
        if (paypal === null || revolut === null) {
            modals.alert({ message: $t('payment.invalid_handle') });
            return;
        }
        isSaving = true;
        try {
            await profileStore.saveHandles({ paypal, revolut });
            onClose();
            toasts.success($t('common.saved'));
            await onSaved?.({ paypal, revolut });
        } catch (e) {
            console.error("Failed to save payment handles", e);
            modals.alert({ message: getErrorMessage(e, $t) });
        } finally {
            isSaving = false;
        }
    }
</script>

{#snippet handleInput(id: 'paypal' | 'revolut', label: string, prefix: string)}
    <div class="space-y-2">
        <Label for={id}>{label}</Label>
        <div class="flex h-11 items-center rounded-control border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
            <span class="select-none pl-3 text-base text-muted-foreground">{prefix}</span>
            {#if id === 'paypal'}
                <input {id} bind:value={paypalInput} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder={$t('settings.payment.handle_placeholder')} class="h-full min-w-0 flex-1 bg-transparent pr-3 text-base outline-hidden" />
            {:else}
                <input {id} bind:value={revolutInput} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder={$t('settings.payment.handle_placeholder')} class="h-full min-w-0 flex-1 bg-transparent pr-3 text-base outline-hidden" />
            {/if}
        </div>
    </div>
{/snippet}

<Modal {isOpen} {onClose} variant="sheet" label={$t('settings.payment.title')}>
    <div class="space-y-1">
        <h2 class="text-xl font-bold">{$t('settings.payment.title')}</h2>
        <p class="text-sm text-muted-foreground">{$t('settings.payment.desc')}</p>
    </div>
    <div class="space-y-4">
        {@render handleInput('paypal', 'PayPal.me', 'paypal.me/')}
        {@render handleInput('revolut', 'Revolut.me', 'revolut.me/')}
    </div>
    <div class="grid grid-cols-2 gap-3">
        <Button variant="secondary" onclick={onClose}>{$t('common.cancel')}</Button>
        <Button onclick={save} disabled={isSaving}>
            {#if isSaving}<LoaderCircle class="animate-spin" />{/if}
            {$t('common.save')}
        </Button>
    </div>
</Modal>
