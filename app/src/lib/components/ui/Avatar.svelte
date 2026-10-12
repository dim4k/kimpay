<script lang="ts">
  import { cn } from "#lib/utils/index.js";
  import { pb } from "#lib/pocketbase.js";

  interface Props {
    name: string;
    /** Explicit image URL (takes precedence over `record`) */
    src?: string | null;
    /** A PocketBase record with an `avatar` file field (participant, user) */
    record?: { id: string; avatar?: string } | null | undefined;
    class?: string;
  }

  let { name, src = null, record = null, class: className = "" }: Props = $props();

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
    return `bg-linear-to-br ${colors[index]![0]} ${colors[index]![1]}`;
  }

  let imageUrl = $derived(src ?? (record?.avatar ? pb.files.getURL(record, record.avatar) : null));
  let gradient = $derived(getGradient(name || ""));
  let initials = $derived(name ? name.slice(0, 2).toUpperCase() : "?");
</script>

<div class={cn("rounded-full flex items-center justify-center text-white font-bold overflow-hidden", !imageUrl && gradient, className)} aria-hidden="true">
  {#if imageUrl}
    <img src={imageUrl} alt="" class="w-full h-full object-cover" />
  {:else}
    {initials}
  {/if}
</div>
