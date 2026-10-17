import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			"font-size": [
				{
					text: [
						"display",
						"h1",
						"h2",
						"h3",
						"h4",
						"body-lg",
						"body",
						"body-sm",
						"body-xs",
						"label",
						"caption",
						"control",
						"value",
						"stat",
					],
				},
			],
		},
	},
});

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
