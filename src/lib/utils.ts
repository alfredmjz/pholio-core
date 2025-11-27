import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines Tailwind CSS classes with proper precedence handling.
 *
 * Merges class names using clsx and resolves Tailwind class conflicts.
 * Later classes take precedence over earlier ones.
 *
 * @param inputs - Class names, objects, or arrays to merge
 * @returns Merged class string with conflicts resolved
 *
 * @example
 * ```typescript
 * cn('px-4 py-2', 'px-6')  // => 'py-2 px-6'
 * cn('text-red-500', condition && 'text-blue-500')  // Conditional classes
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
