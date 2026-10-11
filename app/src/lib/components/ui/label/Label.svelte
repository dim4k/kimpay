<script lang="ts">
	import type { HTMLLabelAttributes } from "svelte/elements";
	import { cn } from "#lib/utils/index.js";

	let { class: className, children, ...restProps }: HTMLLabelAttributes = $props();
</script>

<label
	class={cn(
		"block text-sm font-medium leading-6 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</label>
