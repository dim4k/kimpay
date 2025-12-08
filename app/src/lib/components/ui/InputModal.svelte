<script lang="ts">
  import { scale } from 'svelte/transition';
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

  let { 
      isOpen = false, 
      title, 
      placeholder = "", 
      confirmText = "Confirm", 
      cancelText = "Cancel", 
      isProcessing = false,
      onConfirm, 
      onCancel 
  } = $props();

  let value = $state("");

  function handleSubmit() {
      if (value.trim()) {
          onConfirm(value);
          value = ""; // Reset after submit
      }
  }
</script>

{#if isOpen}
    <div 
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <div 
            class="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-6 dark:border dark:border-slate-800 transition-colors" 
            transition:scale={{ start: 0.95, opacity: 0 }}
        >
            <h2 class="text-xl font-bold text-center text-slate-900 dark:text-slate-100">{title}</h2>
            
            <Input 
                bind:value={value} 
                {placeholder} 
                class="dark:bg-slate-800 dark:border-slate-700"
                autofocus
                onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
            />

            <div class="flex gap-3 pt-2">
                <Button variant="outline" class="flex-1" onclick={onCancel} disabled={isProcessing}>
                    {cancelText}
                </Button>
                <Button 
                    variant="default" 
                    class="flex-1" 
                    onclick={handleSubmit} 
                    disabled={isProcessing || !value.trim()}
                >
                    {isProcessing ? "..." : confirmText}
                </Button>
            </div>
        </div>
        
        <!-- Backdrop click to cancel -->
        <div 
            class="absolute inset-0 -z-10" 
            onclick={onCancel}
            role="button"
            tabindex="-1"
            onkeydown={(e) => e.key === 'Escape' && onCancel()}
        ></div>
    </div>
{/if}
