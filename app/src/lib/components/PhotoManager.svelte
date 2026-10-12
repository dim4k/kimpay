<script lang="ts">
    import { Camera, ChevronRight, X } from "@lucide/svelte";
    import { onDestroy } from 'svelte';
    import { pb } from '#lib/pocketbase.js';
    import { t } from '#lib/i18n.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import type { RecordModel } from 'pocketbase';

    interface Props {
        /** Photos to upload with the expense (a scanned receipt is one of them) */
        newPhotos?: File[];
        /** Existing photo filenames (for edit mode) */
        existingPhotos?: string[];
        /** Existing photos removed by the user, deleted on save */
        photosToDelete?: string[];
        /** PocketBase record for getting existing photo URLs */
        record?: RecordModel | null;
        /** Whether to disable the input (e.g., when offline) */
        disabled?: boolean;
    }

    let {
        newPhotos = $bindable([]),
        existingPhotos = $bindable([]),
        photosToDelete = $bindable([]),
        record = null,
        disabled = false
    }: Props = $props();

    let fileInput: HTMLInputElement;

    // One preview URL per new file, kept as long as the file is in the list.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const previewUrls = new Map<File, string>();
    function previewOf(file: File): string {
        let url = previewUrls.get(file);
        if (!url) {
            url = URL.createObjectURL(file);
            previewUrls.set(file, url);
        }
        return url;
    }

    $effect(() => {
        for (const [file, url] of previewUrls) {
            if (!newPhotos.includes(file)) {
                URL.revokeObjectURL(url);
                previewUrls.delete(file);
            }
        }
    });

    onDestroy(() => {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
    });

    function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files) {
            newPhotos = [...newPhotos, ...Array.from(target.files)];
            target.value = "";
        }
    }

    function removeNewPhoto(file: File) {
        newPhotos = newPhotos.filter((f) => f !== file);
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
    const count = $derived(existingPhotos.length + newPhotos.length);
</script>

{#snippet thumbnail(src: string, alt: string, onremove: () => void)}
    <div class="relative h-20 w-20 shrink-0 overflow-hidden rounded-control border">
        <img {src} {alt} class="h-full w-full object-cover" />
        <button
            type="button"
            onclick={onremove}
            class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive"
            aria-label={$t('photos.remove')}
        >
            <X class="h-3.5 w-3.5" />
        </button>
    </div>
{/snippet}

<!-- A row of a ListGroup: add button, then the thumbnails. -->
<div class="first:rounded-t-[inherit] last:rounded-b-[inherit]">
    <button
        type="button"
        onclick={() => fileInput.click()}
        disabled={isDisabled}
        class="flex w-full min-h-14 items-center gap-3 rounded-[inherit] px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
    >
        <IconTile size="sm"><Camera /></IconTile>
        <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm text-muted-foreground">{$t('expense.form.photos_label')}</span>
            <span class="truncate text-base font-medium">
                {#if isDisabled}
                    {$t('expense.form.photos_disabled_offline')}
                {:else if count > 0}
                    {$t('expense.form.photos_count', { count: String(count) })}
                {:else}
                    {$t('expense.form.add_photos')}
                {/if}
            </span>
        </span>
        <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>

    {#if count > 0}
        <div class="flex gap-2 overflow-x-auto px-4 pb-3">
            {#each existingPhotos as filename (filename)}
                {@render thumbnail(getExistingPhotoUrl(filename), $t('photos.attachment_alt'), () => removeExistingPhoto(filename))}
            {/each}
            {#each newPhotos as file (file)}
                {@render thumbnail(previewOf(file), $t('photos.new_alt'), () => removeNewPhoto(file))}
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
