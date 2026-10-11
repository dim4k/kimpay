import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and merges Tailwind classes.
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Component props plus a bindable `ref` to the rendered element. */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
