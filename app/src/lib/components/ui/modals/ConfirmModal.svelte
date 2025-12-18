<script lang="ts">
  import { LoaderCircle, TriangleAlert, CircleCheck } from "lucide-svelte";
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
            <div class={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${variant === 'destructive' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
            {#if variant === 'destructive'}
                <TriangleAlert class="h-8 w-8" />
            {:else}
                <CircleCheck class="h-8 w-8" />
            {/if}
            </div>
            <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p class="text-muted-foreground">
            {description}
            </p>
    </div>
    
    <div class="grid grid-cols-2 gap-3">
        <button 
            class="py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            onclick={onCancel}
            disabled={isProcessing}
        >
            {cancelText}
        </button>
        <button 
            class={`py-3 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2 ${variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            onclick={onConfirm}
            disabled={isProcessing}
        >
            {#if isProcessing}
                <LoaderCircle class="h-4 w-4 animate-spin" />
            {/if}
            {confirmText}
        </button>
    </div>
</Modal>
