<script lang="ts">
    import { CircleCheck } from "@lucide/svelte";
    import { slide } from 'svelte/transition';

    /** Success message shown in place of a completed form. */
    let { title, description }: { title: string; description: string } = $props();
</script>

<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3 text-green-700 dark:text-green-300" role="status" transition:slide>
    <CircleCheck class="h-5 w-5 shrink-0" />
    <div class="text-sm">
        <p class="font-medium">{title}</p>
        <p class="text-xs opacity-90">{description}</p>
    </div>
</div>
