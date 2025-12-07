<script lang="ts">
  import { Input } from "$lib/components/ui/input";

  let { value = $bindable("💸") } = $props();
  
  let isOpen = $state(false);

  const EMOJIS = ["💸", "✈️", "🏠", "🍕", "🍻", "🎁", "⚽", "🚗", "💼", "🎉", "🍔", "🍺", "🏖️", "🏔️", "🚆", "💊", "🛒", "🎬", "🎤", "🎮", "⛽", "💡", "📱", "💻", "🔧", "👶", "👗", "👠", "🎓", "🏥"];
</script>

<div class="relative">
    <button 
        type="button"
        class="h-10 w-14 rounded-md border border-input bg-background px-3 py-2 text-xl ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 transition-colors"
        onclick={() => isOpen = !isOpen}
    >
        {value}
    </button>
    
    {#if isOpen}
        <div class="absolute top-full mt-2 left-0 z-50 w-64 bg-white rounded-lg shadow-xl border p-2 grid grid-cols-5 gap-2">
            {#each EMOJIS as emoji}
                <button 
                    type="button"
                    class="aspect-square hover:bg-slate-100 rounded-md text-xl flex items-center justify-center transition-colors"
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
