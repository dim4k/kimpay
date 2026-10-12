<script lang="ts">
    import { CircleAlert } from "@lucide/svelte";
    import { slide } from 'svelte/transition';

    /** Inline form error, rendered only when there is a message. */
    let { message }: { message: string } = $props();
</script>

{#if message}
    <div class="flex items-center gap-2 text-sm text-destructive" role="alert" transition:slide>
        <CircleAlert class="h-3 w-3" />
        <span>{message}</span>
    </div>
{/if}
