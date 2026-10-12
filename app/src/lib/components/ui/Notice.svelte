<script lang="ts">
    import { CircleCheck } from "@lucide/svelte";
    import { slide } from 'svelte/transition';

    /** Success message shown in place of a completed form. */
    let { title, description }: { title: string; description: string } = $props();
</script>

<div class="flex items-center gap-3 rounded-control bg-success-soft p-4 text-success" role="status" transition:slide>
    <CircleCheck class="h-5 w-5 shrink-0" />
    <div class="text-sm">
        <p class="font-medium">{title}</p>
        <p class="text-xs opacity-90">{description}</p>
    </div>
</div>
