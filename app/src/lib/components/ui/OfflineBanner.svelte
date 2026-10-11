<script lang="ts">
    import { AlertTriangle } from "@lucide/svelte";
    import { offlineStore } from '#lib/stores/offline.svelte.js';

    /** Shown only while offline, to explain what is limited on this page. */
    let { message }: { message: string } = $props();
</script>

{#if offlineStore.isOffline}
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3" role="status">
        <AlertTriangle class="h-5 w-5 text-amber-500 shrink-0" />
        <p class="text-sm text-amber-700 dark:text-amber-300">{message}</p>
    </div>
{/if}
