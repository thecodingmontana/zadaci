import type { ClassValue } from "cnfast";
import { clsx, twMerge } from "cnfast";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
