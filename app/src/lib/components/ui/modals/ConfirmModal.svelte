<script lang="ts">
  import { LoaderCircle, TriangleAlert, CircleCheck } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import Modal from './Modal.svelte';

  let { 
    isOpen = false, 
    title, 
    description, 
    confirmText = "Confirm", 
    cancelText = "Cancel", 
    variant = "default", // default | destructive
    isProcessing = false,
    onConfirm,
    onCancel
  } = $props();
</script>

<Modal {isOpen} onClose={isProcessing ? undefined : onCancel}>
    <div class="text-center space-y-2">
            <div class={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${variant === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-primary'}`}>
            {#if variant === 'destructive'}
                <TriangleAlert class="h-8 w-8" />
            {:else}
                <CircleCheck class="h-8 w-8" />
            {/if}
            </div>
            <h3 class="text-xl font-bold text-foreground">{title}</h3>
            <p class="text-muted-foreground">
            {description}
            </p>
    </div>
    
    <div class="grid grid-cols-2 gap-3">
        <Button
            variant="secondary"
            class="rounded-xl font-bold"
            onclick={onCancel}
            disabled={isProcessing}
        >
            {cancelText}
        </Button>
        <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            class="rounded-xl font-bold"
            onclick={onConfirm}
            disabled={isProcessing}
        >
            {#if isProcessing}
                <LoaderCircle class="h-4 w-4 animate-spin" />
            {/if}
            {confirmText}
        </Button>
    </div>
</Modal>
