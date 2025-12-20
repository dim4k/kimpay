<script lang="ts">
  import { EMOJI_CATEGORIES, EMOJI_CATEGORY_ORDER, KIMPAY_CATEGORY_ORDER, DEFAULT_EXPENSE_EMOJI } from "$lib/constants";
  import { locale } from "$lib/i18n";

  let { value = $bindable(DEFAULT_EXPENSE_EMOJI), variant = "expense" } = $props<{ 
      value?: string, 
      variant?: "expense" | "kimpay" 
  }>();
  
  let isOpen = $state(false);

  // Use different category orders based on variant
  const categoryOrder = $derived(variant === "kimpay" ? KIMPAY_CATEGORY_ORDER : EMOJI_CATEGORY_ORDER);
  
  function getCategoryLabel(categoryKey: string): string {
      const cat = EMOJI_CATEGORIES[categoryKey];
      if (!cat) return categoryKey;
      return $locale === 'fr' ? cat.labelFr : cat.label;
  }
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
        <div class="absolute top-full mt-2 left-0 z-50 w-80 max-h-72 overflow-y-auto bg-white dark:bg-slate-900 rounded-lg shadow-xl border dark:border-slate-800 p-2">
            {#each categoryOrder as categoryKey (categoryKey)}
                {@const category = EMOJI_CATEGORIES[categoryKey]}
                {#if category}
                    <div class="mb-3 last:mb-0">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                            {getCategoryLabel(categoryKey)}
                        </div>
                        <div class="grid grid-cols-8 gap-0.5">
                            {#each category.emojis as emoji (emoji)}
                                <button 
                                    type="button"
                                    class="aspect-square hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-lg flex items-center justify-center transition-colors {value === emoji ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}"
                                    onclick={() => {
                                        value = emoji;
                                        isOpen = false;
                                    }}
                                >
                                    {emoji}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
        <div class="fixed inset-0 z-40" onclick={() => isOpen = false} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}></div>
    {/if}
</div>

