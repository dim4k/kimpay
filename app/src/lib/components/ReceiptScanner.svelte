<script lang="ts">
    import { ScanLine, Loader2 } from '@lucide/svelte';
    import { t, locale } from '#lib/i18n.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { scanReceipt, compressImage, fileToBase64, type OcrResult } from '#lib/services/ocr.js';
    import { modals } from '#lib/stores/modals.svelte.js';

    export interface ScanResult extends OcrResult {
        photo: File;
    }

    interface Props {
        onScanComplete: (result: ScanResult) => void;
        disabled?: boolean;
    }

    let { onScanComplete, disabled = false }: Props = $props();

    let isScanning = $state(false);
    let fileInput: HTMLInputElement | null = $state(null);
    
    // Reactive auth state (pb.authStore itself is not reactive)
    let isAuthenticated = $derived(auth.isValid);

    async function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        
        if (!file) return;
        
        // Reset input so same file can be selected again
        input.value = '';
        
        if (!file.type.startsWith('image/')) {
            modals.alert({
                title: $t('expense.form.scan_error'),
                message: $t('expense.form.scan_unreadable')
            });
            return;
        }

        isScanning = true;

        try {
            // Compress image to reduce upload size. Formats the browser cannot
            // draw (HEIC outside Safari...) are sent as is: the scanner reads them.
            const compressedBase64 = await compressImage(file).catch(() => fileToBase64(file));
            
            // Call OCR API with current language
            const result = await scanReceipt(compressedBase64, $locale);
            
            // Success! Pass result with the original photo file
            onScanComplete({ ...result, photo: file });
            
        } catch (error) {
            console.error('OCR Error:', error);
            
            // PocketBase errors carry the HTTP status (not in the message).
            const status = (error as { status?: number }).status;
            let errorMessage = $t('expense.form.scan_error');
            if (status === 401) {
                errorMessage = $t('expense.form.scan_login_required');
            } else if (status === 429) {
                errorMessage = $t('expense.form.scan_rate_limited');
            } else if (status === 422) {
                errorMessage = $t('expense.form.scan_unreadable');
            }
            
            modals.alert({
                title: $t('expense.form.scan_error'),
                message: errorMessage
            });
        } finally {
            isScanning = false;
        }
    }

    function openFilePicker() {
        if (!isAuthenticated) {
            modals.alert({
                title: $t('expense.form.scan_login_required'),
                message: $t('expense.form.scan_login_required_desc')
            });
            return;
        }
        fileInput?.click();
    }
</script>

<!-- Hidden file input -->
<input
    type="file"
    accept="image/*"
    capture="environment"
    class="hidden"
    bind:this={fileInput}
    onchange={handleFileSelect}
/>

<!-- Scanner Button (top bar of the expense form). Without an account it
     explains how to get the feature instead of taking up the form. -->
<button
    type="button"
    onclick={openFilePicker}
    disabled={disabled || isScanning}
    class="relative flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
    aria-label={isScanning ? $t('expense.form.scanning') : $t('expense.form.scan_receipt')}
    title={isScanning ? $t('expense.form.scanning') : $t('expense.form.scan_receipt')}
>
    {#if isScanning}
        <Loader2 class="h-5 w-5 animate-spin" />
    {:else}
        <ScanLine class="h-5 w-5" />
    {/if}
    <span class="hidden sm:inline">{$t('expense.form.scan_short')}</span>
</button>
