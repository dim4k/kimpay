<script lang="ts">
    import Skeleton from './Skeleton.svelte';

    let { count = 4 } = $props<{ count?: number }>();
</script>

<div class="space-y-3">
    {#each Array(count) as _, i (i)}
        <div
            class="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm animate-pop-in"
            style="animation-delay: {i * 60}ms;"
        >
            <Skeleton class="h-10 w-10 shrink-0" rounded="rounded-full" />
            <div class="flex-1 space-y-2">
                <Skeleton class="h-4 w-1/2" />
                <Skeleton class="h-3 w-1/3" />
            </div>
            <Skeleton class="h-6 w-16 shrink-0" rounded="rounded-full" />
        </div>
    {/each}
</div>
