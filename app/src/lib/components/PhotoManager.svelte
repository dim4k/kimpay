<script lang="ts">
    import { Camera, ChevronRight, X } from "@lucide/svelte";
    import { pb } from '#lib/pocketbase.js';
    import { t } from '#lib/i18n.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
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

    const isDisabled = $derived(disabled || offlineStore.isOffline);
</script>

<!-- A row of a ListGroup: add button, then the thumbnails. -->
<div class="first:rounded-t-[inherit] last:rounded-b-[inherit]">
    <button
        type="button"
        onclick={() => fileInput.click()}
        disabled={isDisabled}
        class="flex w-full min-h-14 items-center gap-3 rounded-[inherit] px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
    >
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Camera class="h-4 w-4" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm text-muted-foreground">{$t('expense.form.photos_label')}</span>
            <span class="truncate text-base font-medium">
                {isDisabled ? $t('expense.form.photos_disabled_offline') : $t('expense.form.add_photos')}
            </span>
        </span>
        <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>

    {#if existingPhotos.length > 0 || photoPreviews.length > 0}
        <div class="flex gap-2 overflow-x-auto px-4 pb-3">
            {#each existingPhotos as filename (filename)}
                <div class="relative h-20 w-20 shrink-0 overflow-hidden rounded-control border">
                    <img src={getExistingPhotoUrl(filename)} alt={$t('photos.attachment_alt')} class="h-full w-full object-cover" />
                    <button
                        type="button"
                        onclick={() => removeExistingPhoto(filename)}
                        class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive"
                        aria-label={$t('photos.remove')}
                    >
                        <X class="h-3.5 w-3.5" />
                    </button>
                </div>
            {/each}
            {#each photoPreviews as preview, i (i)}
                <div class="relative h-20 w-20 shrink-0 overflow-hidden rounded-control border">
                    <img src={preview} alt={$t('photos.new_alt')} class="h-full w-full object-cover" />
                    <button
                        type="button"
                        onclick={() => removeNewPhoto(i)}
                        class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive"
                        aria-label={$t('photos.remove')}
                    >
                        <X class="h-3.5 w-3.5" />
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <input
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        bind:this={fileInput}
        onchange={handleFileSelect}
    />
</div>
