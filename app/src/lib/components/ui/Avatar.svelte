<script lang="ts">
  import { cn } from "#lib/utils/index.js";
  import { pb } from "#lib/pocketbase.js";
  import { activeKimpayGlobal } from "#lib/stores/activeKimpayGlobal.svelte.js";
  import { AVATAR_GRADIENTS, nameColor, nameInitials } from "#lib/utils/avatar.js";

  interface Props {
    name: string;
    /** Explicit image URL (takes precedence over `record`) */
    src?: string | null;
    /** A PocketBase record with an `avatar` file field (participant, user) */
    record?: { id: string; avatar?: string } | null | undefined;
    class?: string;
  }

  let { name, src = null, record = null, class: className = "" }: Props = $props();

  let imageUrl = $derived(src ?? (record?.avatar ? pb.files.getURL(record, record.avatar) : null));
  // A member of the open group: initials and color told apart from the
  // others' (see groupAvatarLooks). Anyone else: from the name alone.
  let look = $derived(
    (record && activeKimpayGlobal.instance?.avatarLooks.get(record.id)) ||
      { initials: name ? nameInitials(name) : "?", color: nameColor(name || "") }
  );
</script>

<div class={cn("rounded-full flex items-center justify-center text-white font-bold overflow-hidden", !imageUrl && `bg-linear-to-br ${AVATAR_GRADIENTS[look.color]}`, className)} aria-hidden="true">
  {#if imageUrl}
    <img src={imageUrl} alt="" class="w-full h-full object-cover" />
  {:else}
    {look.initials}
  {/if}
</div>
