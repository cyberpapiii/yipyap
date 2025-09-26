import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Type helper for shadcn-svelte components
export type WithElementRef<T> = T & {
	ref?: any;
};