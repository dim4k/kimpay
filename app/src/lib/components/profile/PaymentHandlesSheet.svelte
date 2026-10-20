<script lang="ts">
    import { t } from '#lib/i18n.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import FieldError from '#lib/components/ui/FieldError.svelte';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';
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

    let inputs = $state({ paypal: '', revolut: '' });
    let errors = $state({ paypal: '', revolut: '' });
    let isSaving = $state(false);

    // Start from the profile each time the sheet opens.
    $effect(() => {
        if (!isOpen) return;
        inputs = { paypal: profileStore.handles.paypal, revolut: profileStore.handles.revolut };
        errors = { paypal: '', revolut: '' };
    });

    async function save() {
        const paypal = normalizeHandle(inputs.paypal);
        const revolut = normalizeHandle(inputs.revolut);
        errors = {
            paypal: paypal === null ? $t('payment.invalid_handle') : '',
            revolut: revolut === null ? $t('payment.invalid_handle') : '',
        };
        if (paypal === null || revolut === null) return;

        isSaving = true;
        try {
            await profileStore.saveHandles({ paypal, revolut });
            onClose();
            toasts.success($t('common.saved'));
            await onSaved?.({ paypal, revolut });
        } catch (e) {
            console.error("Failed to save payment handles", e);
            toasts.error(getErrorMessage(e, $t));
        } finally {
            isSaving = false;
        }
    }
</script>

{#snippet handleInput(id: 'paypal' | 'revolut', label: string, prefix: string)}
    <div class="space-y-2">
        <Label for={id}>{label}</Label>
        <div class="flex h-11 items-center rounded-control border bg-card focus-within:ring-2 focus-within:ring-ring {errors[id] ? 'border-destructive' : 'border-input'}">
            <span class="select-none pl-3 text-base text-muted-foreground">{prefix}</span>
            <input
                {id}
                bind:value={inputs[id]}
                oninput={() => errors[id] = ''}
                aria-invalid={!!errors[id]}
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder={$t('settings.payment.handle_placeholder')}
                class="h-full min-w-0 flex-1 bg-transparent pr-3 text-base outline-hidden"
            />
        </div>
        <FieldError message={errors[id]} />
    </div>
{/snippet}

{#snippet footer()}
    <Button size="lg" class="w-full" onclick={save} loading={isSaving}>{$t('common.save')}</Button>
{/snippet}

<Modal {isOpen} {onClose} variant="sheet" label={$t('settings.payment.title')} {footer}>
    {#snippet header()}
        <ModalHeader title={$t('settings.payment.title')} description={$t('settings.payment.desc')} align="start" {onClose} />
    {/snippet}
    <div class="space-y-4">
        {@render handleInput('paypal', 'PayPal.me', 'paypal.me/')}
        {@render handleInput('revolut', 'Revolut.me', 'revolut.me/')}
    </div>
</Modal>
