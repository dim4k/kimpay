<script lang="ts">
    import { AlertTriangle } from "@lucide/svelte";
    import { offlineStore } from '#lib/stores/offline.svelte.js';

    /** Shown only while offline, to explain what is limited on this page. */
    let { message }: { message: string } = $props();
</script>

{#if offlineStore.isOffline}
    <div class="flex items-center gap-3 rounded-card bg-warning-soft p-4 text-warning" role="status">
        <AlertTriangle class="h-5 w-5 shrink-0" />
        <p class="text-sm font-medium">{message}</p>
    </div>
{/if}
