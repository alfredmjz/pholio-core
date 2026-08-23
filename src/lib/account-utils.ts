/**
 * Utility functions for consistent account display and sorting across dialogs and selectors.
 */

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

/**
 * Sort accounts consistently by institution name, then account name.
 */
export function sortAccounts<T extends AccountLike>(accounts: T[]): T[] {
	return [...accounts].sort((a, b) => {
		const aInst = a.institution || "";
		const bInst = b.institution || "";
		if (aInst !== bInst) return aInst.localeCompare(bInst);
		return a.name.localeCompare(b.name);
	});
}
