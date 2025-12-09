<script lang="ts">
  import { KIMPAY_EMOJIS, EXPENSE_EMOJIS, DEFAULT_EXPENSE_EMOJI } from "$lib/constants";

  let { value = $bindable(DEFAULT_EXPENSE_EMOJI), variant = "expense" } = $props<{ 
      value?: string, 
      variant?: "expense" | "kimpay" 
  }>();
  
  let isOpen = $state(false);

  const emojis = $derived(variant === "kimpay" ? KIMPAY_EMOJIS : EXPENSE_EMOJIS);
</script>

<div class="relative">
    <button 
        type="button"
        class="h-10 w-14 rounded-md border border-input bg-background px-3 py-2 text-xl ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        onclick={() => isOpen = !isOpen}
    >
        {value}
    </button>
    
    {#if isOpen}
        <div class="absolute top-full mt-2 left-0 z-50 w-72 bg-white dark:bg-slate-900 rounded-lg shadow-xl border dark:border-slate-800 p-2 grid grid-cols-6 gap-1">
            {#each emojis as emoji (emoji)}
                <button 
                    type="button"
                    class="aspect-square hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-xl flex items-center justify-center transition-colors"
                    onclick={() => {
                        value = emoji;
                        isOpen = false;
                    }}
                >
                    {emoji}
                </button>
            {/each}
        </div>
        <div class="fixed inset-0 z-40" onclick={() => isOpen = false} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}></div>
    {/if}
</div>
