<script lang="ts">
	import type { HTMLLabelAttributes } from "svelte/elements";
	import { cn } from "#lib/utils/index.js";

	/**
	 * The label of a field. `tag="span"` for the label of a group of controls
	 * (chips, segmented control), which has no single input to point to.
	 */
	let { class: className, tag = "label", children, ...restProps }: HTMLLabelAttributes & { tag?: "label" | "span" } = $props();
</script>

<svelte:element
	this={tag}
	class={cn(
		"block text-sm font-semibold text-muted-foreground leading-6 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
