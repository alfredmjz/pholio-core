/**
 * Shared alphabetical sorting helpers for dialog option lists.
 *
 * Every list a user picks from (accounts, categories, presets, account types, description
 * suggestions) is ordered by the label the user actually reads, so an item always appears
 * in the same position regardless of the order the data arrived in.
 */

/**
 * Strips leading emoji/symbols so a label such as "💰 Deposit" sorts under "D"
 * instead of before every letter.
 */
function toSortKey(label: string): string {
	const match = label.match(/[0-9A-Za-z\u00C0-\u024F]/);
	return match && match.index !== undefined ? label.slice(match.index) : label;
}

/**
 * Alphabetical comparator that ignores case and leading emoji/symbols.
 * Safe to pass directly to `Array.prototype.sort`.
 */
export function compareAlphabetically(a: string, b: string): number {
	return toSortKey(a).localeCompare(toSortKey(b), undefined, { sensitivity: "base", numeric: true });
}

/**
 * Returns a new alphabetically sorted array; `getLabel` selects the text to sort by.
 * The input array is never mutated.
 */
export function sortAlphabetically<T>(items: T[], getLabel: (item: T) => string): T[] {
	return [...items].sort((a, b) => compareAlphabetically(getLabel(a), getLabel(b)));
}
