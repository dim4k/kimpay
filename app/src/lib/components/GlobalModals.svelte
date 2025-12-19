<script lang="ts">
  import { modals } from '$lib/stores/modals.svelte';


  let confirmState = $derived(modals.confirmState);
  let alertState = $derived(modals.alertState);
  let galleryState = $derived(modals.galleryState);
  let identityState = $derived(modals.identityState);
  
  let isProcessing = $state(false);

  async function handleConfirm() {
    if (confirmState?.onConfirm) {
        isProcessing = true;
        try {
            await confirmState.onConfirm();
            modals.closeConfirm();
        } catch (e) {
            console.error(e);
        } finally {
            isProcessing = false;
        }
    }
  }

  function handleCancel() {
    confirmState?.onCancel?.();
    modals.closeConfirm();
  }
</script>

{#if confirmState}
    {#await import('$lib/components/ui/modals/ConfirmModal.svelte') then { default: ConfirmModal }}
    <ConfirmModal 
        isOpen={true}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText ?? "Confirm"}
        cancelText={confirmState.cancelText ?? "Cancel"}
        variant={confirmState.variant ?? "default"}
        isProcessing={isProcessing}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
    />
    {/await}
{/if}

{#if alertState}
    {#await import('$lib/components/ui/modals/AlertModal.svelte') then { default: AlertModal }}
    <AlertModal 
        isOpen={true}
        title={alertState.title ?? ""}
        message={alertState.message}
        onConfirm={() => {
            alertState.onConfirm?.();
            modals.closeAlert();
        }}
        variant={alertState.variant ?? 'error'}
    />
    {/await}
{/if}

{#if galleryState}
    {#await import('$lib/components/ui/modals/PhotoGalleryModal.svelte') then { default: PhotoGalleryModal }}
    <PhotoGalleryModal 
        isOpen={true}
        photos={galleryState.photos}
        record={galleryState.record}
        onClose={() => modals.closeGallery()}
    />
    {/await}
{/if}

{#if identityState}
    {#await import('$lib/components/ui/modals/IdentityModal.svelte') then { default: IdentityModal }}
    <IdentityModal 
        isOpen={true} 
    />
    {/await}
{/if}

{#if modals.registerState}
    {#await import('$lib/components/ui/modals/RegisterModal.svelte') then { default: RegisterModal }}
    <RegisterModal 
        isOpen={true}
        onClose={() => modals.closeRegister()}
        participantId={modals.registerState.participantId || ""}
    />
    {/await}
{/if}
