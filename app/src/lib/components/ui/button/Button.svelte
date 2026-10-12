<script lang="ts" module>
	import type { WithElementRef } from "#lib/utils/cn.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";

	export const buttonVariants = tv({
		base: "ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold transition-[color,background-color,border-color,transform] duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline: "border-input bg-card text-foreground hover:bg-muted border",
				secondary: "bg-muted text-foreground hover:bg-muted/70",
				soft: "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70",
				ghost: "text-foreground hover:bg-muted",
				"ghost-destructive": "text-destructive hover:bg-destructive/10",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-11 px-4",
				sm: "h-9 px-3",
				lg: "h-12 px-6 text-base",
				icon: "h-11 w-11",
				"icon-sm": "h-9 w-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	import { cn } from "#lib/utils/index.js";

	let {
		class: className,
		variant = "default",
		size = "default",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		class={cn(buttonVariants({ variant, size }), className)}
		{href}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
