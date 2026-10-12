<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import type { WithElementRef } from "#lib/utils/cn.js";
	import { cn } from "#lib/utils/index.js";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		...restProps
	}: Props = $props();
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		class={cn(
			"border-input bg-card text-foreground ring-offset-background focus-visible:ring-ring flex h-11 w-full rounded-control border px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		class={cn(
			"border-input bg-card text-foreground ring-offset-background focus-visible:ring-ring flex h-11 w-full rounded-control border px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
