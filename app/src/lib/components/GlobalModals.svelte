<script lang="ts">
  import { modals } from '$lib/stores/modals';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import AlertModal from '$lib/components/ui/AlertModal.svelte';
  import PhotoGallery from '$lib/components/ui/PhotoGallery.svelte';
  import IdentityModal from '$lib/components/ui/IdentityModal.svelte';

  let confirmState = $derived($modals.confirm);
  let alertState = $derived($modals.alert);
  let galleryState = $derived($modals.gallery);
  let identityState = $derived($modals.identity);
  
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
    <ConfirmModal 
        isOpen={true}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
        isProcessing={isProcessing}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
    />
{/if}

{#if alertState}
    <AlertModal 
        isOpen={true}
        title={alertState.title}
        message={alertState.message}
        onConfirm={() => {
            alertState.onConfirm?.();
            modals.closeAlert();
        }}
    />
{/if}

{#if galleryState}
    <PhotoGallery 
        isOpen={true}
        photos={galleryState.photos}
        record={galleryState.record}
        onClose={modals.closeGallery}
    />
{/if}

{#if identityState}
    <IdentityModal 
        isOpen={true} 
    />
{/if}
