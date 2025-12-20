<script lang="ts">
    import { Camera, Loader2 } from 'lucide-svelte';
    import { t } from '$lib/i18n';
    import { pb } from '$lib/pocketbase';
    import { scanReceipt, compressImage, type OcrResult } from '$lib/services/ocr';
    import { modals } from '$lib/stores/modals.svelte';

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
    
    // Check if user is authenticated
    let isAuthenticated = $derived(pb.authStore.isValid);

    async function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        
        if (!file) return;
        
        // Reset input so same file can be selected again
        input.value = '';
        
        if (!file.type.startsWith('image/')) {
            modals.alert({
                title: $t('expense.form.scan_error'),
                message: 'Please select an image file'
            });
            return;
        }

        isScanning = true;

        try {
            // Compress image to reduce upload size
            const compressedBase64 = await compressImage(file);
            
            // Call OCR API
            const result = await scanReceipt(compressedBase64);
            
            // Success! Pass result with the original photo file
            onScanComplete({ ...result, photo: file });
            
        } catch (error) {
            console.error('OCR Error:', error);
            
            let errorMessage = $t('expense.form.scan_error');
            
            if (error instanceof Error) {
                // Check for specific error codes
                if (error.message.includes('401')) {
                    errorMessage = $t('expense.form.scan_login_required');
                } else if (error.message.includes('429')) {
                    errorMessage = $t('expense.form.scan_rate_limited');
                } else if (error.message.includes('422')) {
                    errorMessage = $t('expense.form.scan_unreadable');
                }
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

<!-- Scanner Button -->
<button
    type="button"
    onclick={openFilePicker}
    disabled={disabled || isScanning}
    class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl 
           bg-gradient-to-r from-indigo-500/10 to-purple-500/10 
           dark:from-indigo-500/20 dark:to-purple-500/20
           border border-indigo-200 dark:border-indigo-800
           hover:from-indigo-500/20 hover:to-purple-500/20
           dark:hover:from-indigo-500/30 dark:hover:to-purple-500/30
           transition-all duration-200
           disabled:opacity-50 disabled:cursor-not-allowed
           group"
>
    {#if isScanning}
        <Loader2 class="h-5 w-5 text-indigo-500 animate-spin" />
        <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {$t('expense.form.scanning')}
        </span>
    {:else}
        <Camera class="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
        <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
            {$t('expense.form.scan_receipt')}
        </span>
        {#if !isAuthenticated}
            <span class="text-xs text-slate-400 dark:text-slate-500 ml-1">
                ({$t('expense.form.scan_login_required')})
            </span>
        {/if}
    {/if}
</button>
