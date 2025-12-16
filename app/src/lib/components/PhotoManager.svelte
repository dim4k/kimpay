<script lang="ts">
    import { Camera, X } from "lucide-svelte";
    import { pb } from '$lib/pocketbase';
    import { t } from '$lib/i18n';
    import { offlineService } from '$lib/services/offline.svelte';
    import type { RecordModel } from 'pocketbase';

    interface Props {
        /** Existing photo filenames (for edit mode) */
        existingPhotos?: string[];
        /** PocketBase record for getting existing photo URLs */
        record?: RecordModel | null;
        /** Callback when photos change */
        onPhotosChange: (newPhotos: File[], existingPhotos: string[], photosToDelete: string[]) => void;
        /** Whether to disable the input (e.g., when offline) */
        disabled?: boolean;
    }

    let { 
        existingPhotos = $bindable([]), 
        record = null, 
        onPhotosChange,
        disabled = false
    }: Props = $props();

    let newPhotos = $state<File[]>([]);
    let photoPreviews = $state<string[]>([]);
    let photosToDelete = $state<string[]>([]);
    let fileInput: HTMLInputElement;

    // Notify parent of changes
    $effect(() => {
        onPhotosChange(newPhotos, existingPhotos, photosToDelete);
    });

    function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files) {
            const files = Array.from(target.files);
            newPhotos = [...newPhotos, ...files];
            
            // Create previews
            const newPreviews = files.map(file => URL.createObjectURL(file));
            photoPreviews = [...photoPreviews, ...newPreviews];
            
            // Reset input
            target.value = "";
        }
    }

    function removeNewPhoto(index: number) {
        newPhotos = newPhotos.filter((_, i) => i !== index);
        const preview = photoPreviews[index];
        if (preview) URL.revokeObjectURL(preview);
        photoPreviews = photoPreviews.filter((_, i) => i !== index);
    }

    function removeExistingPhoto(filename: string) {
        existingPhotos = existingPhotos.filter(p => p !== filename);
        photosToDelete = [...photosToDelete, filename];
    }

    function getExistingPhotoUrl(filename: string) {
        if (!record?.id || !record?.collectionId) return "";
        return pb.files.getURL(record, filename, { thumb: '100x100' });
    }

    const isDisabled = $derived(disabled || offlineService.isOffline);
</script>

<div class="space-y-2">
    <span class="text-sm font-medium">{$t('expense.form.photos_label')}</span>
    
    <!-- Existing Photos (Edit Mode) -->
    {#if existingPhotos.length > 0}
        <div class="flex gap-2 overflow-x-auto pb-2">
            {#each existingPhotos as filename (filename)}
                <div class="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 group">
                    <img 
                        src={getExistingPhotoUrl(filename)} 
                        alt="Existing attachment" 
                        class="w-full h-full object-cover" 
                    />
                    <button 
                        type="button"
                        onclick={() => removeExistingPhoto(filename)}
                        class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove photo"
                    >
                        <X class="h-3 w-3" />
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <!-- New Photos -->
    {#if photoPreviews.length > 0}
        <div class="flex gap-2 overflow-x-auto pb-2">
            {#each photoPreviews as preview, i (i)}
                <div class="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                    <img src={preview} alt="New Upload" class="w-full h-full object-cover" />
                    <button 
                        type="button"
                        onclick={() => removeNewPhoto(i)}
                        class="absolute top-1 right-1 bg-slate-900/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors"
                        aria-label="Remove photo"
                    >
                        <X class="h-3 w-3" />
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Add Photo Button -->
    <button 
        onclick={() => fileInput.click()}
        disabled={isDisabled}
        class="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-primary hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-500 disabled:hover:border-slate-300 disabled:hover:bg-transparent"
    >
        <Camera class="h-5 w-5" />
        <span class="font-medium">
            {isDisabled ? ($t('expense.form.photos_disabled_offline') || "Photos disabled offline") : $t('expense.form.add_photos')}
        </span>
    </button>
    
    <input 
        type="file" 
        accept="image/*" 
        multiple 
        class="hidden" 
        bind:this={fileInput}
        onchange={handleFileSelect}
    />
</div>
