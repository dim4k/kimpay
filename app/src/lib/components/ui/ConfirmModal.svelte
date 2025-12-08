<script lang="ts">
  import { Loader2, AlertTriangle, CheckCircle } from "lucide-svelte";
  import { fade, scale } from 'svelte/transition';

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

  function handleBackdropClick(e: MouseEvent) {
      if (!isProcessing && e.target === e.currentTarget) onCancel();
  }
</script>

{#if isOpen}
    <div 
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" 
        transition:fade 
        onclick={handleBackdropClick} 
        role="button" 
        tabindex="-1" 
        onkeydown={(e) => e.key === 'Escape' && onCancel()}
    >
        <div 
            class="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-6 dark:border dark:border-slate-800 transition-colors" 
            transition:scale={{ start: 0.95, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            <div class="text-center space-y-2">
                 <div class={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${variant === 'destructive' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {#if variant === 'destructive'}
                        <AlertTriangle class="h-8 w-8" />
                    {:else}
                        <CheckCircle class="h-8 w-8" />
                    {/if}
                 </div>
                 <h3 class="text-xl font-bold text-slate-900">{title}</h3>
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
                        <Loader2 class="h-4 w-4 animate-spin" />
                    {/if}
                    {confirmText}
                </button>
            </div>
        </div>
    </div>
{/if}
