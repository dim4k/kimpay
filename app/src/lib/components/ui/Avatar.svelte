<script lang="ts">
  import { cn } from "$lib/utils";

  let { name, src = null, class: className = "" } = $props();

  function getGradient(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      ['from-pink-500', 'to-rose-500'],
      ['from-purple-500', 'to-indigo-500'],
      ['from-blue-500', 'to-cyan-500'],
      ['from-green-500', 'to-emerald-500'],
      ['from-yellow-400', 'to-orange-500'],
      ['from-red-500', 'to-orange-500'],
      ['from-indigo-400', 'to-purple-500'],
      ['from-teal-400', 'to-blue-500'],
    ];
    
    const index = Math.abs(hash) % colors.length;
    return `bg-gradient-to-br ${colors[index][0]} ${colors[index][1]}`;
  }

  let gradient = $derived(getGradient(name || ""));
  let initials = $derived(name ? name.slice(0, 2).toUpperCase() : "?");
</script>

<div class={cn("rounded-full flex items-center justify-center text-white font-bold shadow-sm overflow-hidden", !src && gradient, className)}>
  {#if src}
    <img src={src} alt={name} class="w-full h-full object-cover" />
  {:else}
    {initials}
  {/if}
</div>
