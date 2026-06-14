<script lang="ts">
    import { cn } from "$lib/utils";

    let {
        class: className = "",
        rounded = "rounded-lg"
    } = $props<{
        class?: string;
        rounded?: string;
    }>();
</script>

<div class={cn("animate-pulse bg-muted", rounded, className)}></div>
