import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** "1 person", "3 people": a count with the right word. */
export const count = (n: number, one: string, many = `${one}s`) =>
	`${n} ${n === 1 ? one : many}`;
