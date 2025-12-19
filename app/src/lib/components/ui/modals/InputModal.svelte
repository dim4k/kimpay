<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import Modal from './Modal.svelte';

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

<Modal {isOpen} onClose={isProcessing ? undefined : onCancel}>
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
</Modal>
