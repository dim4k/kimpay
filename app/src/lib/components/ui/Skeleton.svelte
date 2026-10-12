<script lang="ts">
    import { cn } from "#lib/utils/index.js";

    let {
        class: className = "",
        rounded = "rounded-md"
    }: {
        class?: string;
        rounded?: string;
    } = $props();
</script>

<div class={cn("animate-pulse bg-muted", rounded, className)}></div>
