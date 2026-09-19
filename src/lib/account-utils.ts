/**
 * Utility functions for consistent account display and sorting across dialogs and selectors.
 */

import { compareAlphabetically, sortAlphabetically } from "@/lib/sort-utils";

export interface AccountLike {
	id: string;
	name: string;
	institution?: string | null;
	display_order?: number;
}

/**
 * Format account name consistently.
 * Prevents redundant outputs like "Robinhood - Robinhood" or "Chase - Chase Checking".
 */
export function formatAccountDisplayName(account: AccountLike): string {
	if (!account.institution || !account.institution.trim()) {
		return account.name;
	}

	const inst = account.institution.trim();
	const name = account.name.trim();

	if (name.toLowerCase() === inst.toLowerCase()) {
		return name;
	}

	if (name.toLowerCase().startsWith(inst.toLowerCase())) {
		return name;
	}

	return `${inst} - ${name}`;
}

export interface AccountTypeLike {
	name: string;
	code?: string | null;
}

/**
 * Sort account types alphabetically while always keeping the customisable "Other"
 * type last, so it reads as the escape hatch instead of an alphabetical entry.
 */
export function sortAccountTypes<T extends AccountTypeLike>(types: T[]): T[] {
	const core = sortAlphabetically(
		types.filter((type) => type.code !== "other"),
		(type) => type.name
	);
	const other = sortAlphabetically(
		types.filter((type) => type.code === "other"),
		(type) => type.name
	);
	return [...core, ...other];
}

/**
 * Sort accounts alphabetically by the same label the dropdowns display
 * ("Institution - Name" when an institution is set, otherwise the account name).
 */
export function sortAccounts<T extends AccountLike>(accounts: T[]): T[] {
	// Sorting by the formatted label keeps every account selector in an identical,
	// alphabetical order regardless of whether an account has an institution.
	return [...accounts].sort((a, b) => compareAlphabetically(formatAccountDisplayName(a), formatAccountDisplayName(b)));
}
