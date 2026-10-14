<script lang="ts">
    import { CircleAlert } from "@lucide/svelte";
    import { slide } from 'svelte/transition';

    /**
     * Inline form error, rendered only when there is a message. `id`: for the
     * field's `aria-describedby`, so the error is read with it.
     */
    let { message, id }: { message: string; id?: string } = $props();
</script>

{#if message}
    <div {id} class="flex items-center gap-2 text-sm text-destructive" role="alert" transition:slide>
        <CircleAlert class="h-4 w-4 shrink-0" />
        <span>{message}</span>
    </div>
{/if}
