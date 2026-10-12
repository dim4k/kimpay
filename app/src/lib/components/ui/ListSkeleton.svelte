<script lang="ts">
    import Skeleton from './Skeleton.svelte';

    let { count = 4 }: { count?: number } = $props();
</script>

<div class="divide-y rounded-card border bg-card animate-pop-in">
    {#each Array(count) as _, i (i)}
        <div class="flex items-center gap-3 px-4 py-3">
            <Skeleton class="h-10 w-10 shrink-0" rounded="rounded-control" />
            <div class="flex-1 space-y-2">
                <Skeleton class="h-4 w-1/2" />
                <Skeleton class="h-3 w-1/3" />
            </div>
            <Skeleton class="h-5 w-16 shrink-0" />
        </div>
    {/each}
</div>
