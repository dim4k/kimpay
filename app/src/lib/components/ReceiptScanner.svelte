<script lang="ts">
    import { Camera, ChevronRight, LoaderCircle, ScanLine } from '@lucide/svelte';
    import { t } from '#lib/i18n.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import IconTile from '#lib/components/ui/IconTile.svelte';

    interface Props {
        /**
         * `card`: the invitation at the top of an empty expense form.
         * `button`: compact, in the form's top bar once the card is gone.
         * `action`: a full-width button (empty expense list).
         */
        variant?: 'card' | 'button' | 'action';
        /** A photo was picked: it is the caller's to read */
        onPick: (file: File) => void;
        /** A scan is running */
        busy?: boolean;
        disabled?: boolean;
    }

    let { variant = 'button', onPick, busy = false, disabled = false }: Props = $props();

    let fileInput: HTMLInputElement | null = $state(null);

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        // Reset so the same photo can be picked again.
        input.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toasts.error($t('expense.form.scan_unreadable'));
            return;
        }
        onPick(file);
    }

    function open() {
        // Scanning uses a paid API: it needs an account (free).
        if (!auth.isValid) {
            modals.register({ description: $t('expense.form.scan_account_desc') });
            return;
        }
        fileInput?.click();
    }
</script>

<input
    type="file"
    accept="image/*"
    capture="environment"
    class="hidden"
    bind:this={fileInput}
    onchange={handleFileSelect}
/>

{#if variant === 'card'}
    <button
        type="button"
        onclick={open}
        disabled={disabled || busy}
        class="flex w-full items-center gap-3 rounded-card bg-primary-soft p-3 text-left transition-colors duration-150 hover:bg-primary-soft/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
        <IconTile class="h-11 w-11 bg-primary text-primary-foreground"><Camera /></IconTile>
        <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-base font-semibold text-primary-soft-foreground">{$t('expense.form.scan_receipt')}</span>
            <span class="text-sm text-muted-foreground">
                {auth.isValid ? $t('expense.form.scan_card_desc') : $t('expense.form.scan_card_account')}
            </span>
        </span>
        <ChevronRight class="h-5 w-5 shrink-0 text-primary-soft-foreground" />
    </button>
{:else if variant === 'action'}
    <Button variant="soft" size="lg" class="w-full" onclick={open} {disabled}>
        <Camera class="size-5!" />
        {$t('expense.form.scan_receipt')}
    </Button>
{:else}
    <button
        type="button"
        onclick={open}
        disabled={disabled || busy}
        class="flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
        title={$t('expense.form.scan_receipt')}
    >
        {#if busy}
            <LoaderCircle class="h-5 w-5 animate-spin" />
        {:else}
            <ScanLine class="h-5 w-5" />
        {/if}
        {$t('expense.form.scan_short')}
    </button>
{/if}
