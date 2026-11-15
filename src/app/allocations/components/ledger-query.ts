import type { AccountWithType } from "@/app/accounts/types";
import { formatAccountDisplayName } from "@/lib/account-utils";
import type { Transaction } from "../types";
import { getTransferAccountIds } from "../utils/transfer-accounts";
import { inferTransactionType } from "./TransactionTypeIcon";
import type { TransactionType } from "./TransactionTypeIcon";

export type SortField = "date" | "name" | "amount" | "category" | "account" | "type";
export type SortDirection = "asc" | "desc";

export interface SortCriterion {
	field: SortField;
	direction: SortDirection;
}

export interface LedgerQuery {
	searchQuery: string;
	categoryFilter: string;
	typeFilter: TransactionType | null;
	minAmount: string;
	maxAmount: string;
	sorts: SortCriterion[];
}

/**
 * Resolve the account label shown in the ledger's "Accounts" column.
 * Transfers show "source → destination"; any side that cannot be matched to a
 * tracked account is rendered as "External". Non-transfers show their single
 * account, or an em dash when the transaction is not tagged to an account.
 */
export function resolveAccountLabel(transaction: Transaction, accounts: AccountWithType[]): string {
	const accountName = (accountId?: string | null): string | null => {
		if (!accountId) return null;
		const account = accounts.find((a) => a.id === accountId);
		return account ? formatAccountDisplayName(account) : null;
	};

	if (transaction.source === "transfer") {
		const { fromAccountId, toAccountId } = getTransferAccountIds(transaction);

		const from = accountName(fromAccountId) ?? "External";
		const to = accountName(toAccountId) ?? "External";
		return `${from} → ${to}`;
	}

	return accountName(transaction.account_id ?? transaction.linked_account_transaction?.account_id ?? null) ?? "—";
}

export function compareTransactions(
	a: Transaction,
	b: Transaction,
	field: SortField,
	accounts: AccountWithType[]
): number {
	switch (field) {
		case "name":
			return a.name.localeCompare(b.name);
		case "amount":
			return Math.abs(a.amount) - Math.abs(b.amount);
		case "date":
			return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
		case "category":
			return (a.category_name || "").localeCompare(b.category_name || "");
		case "account":
			return resolveAccountLabel(a, accounts).localeCompare(resolveAccountLabel(b, accounts));
		case "type":
			return inferTransactionType(a).localeCompare(inferTransactionType(b));
		default:
			return 0;
	}
}

export function filterAndSortTransactions(
	transactions: Transaction[],
	accounts: AccountWithType[],
	query: LedgerQuery
): Transaction[] {
	const { searchQuery, categoryFilter, typeFilter, minAmount, maxAmount, sorts } = query;
	let filtered = transactions;

	if (searchQuery) {
		const needle = searchQuery.toLowerCase();
		filtered = filtered.filter(
			(t) =>
				t.name.toLowerCase().includes(needle) ||
				t.category_name?.toLowerCase().includes(needle) ||
				t.notes?.toLowerCase().includes(needle)
		);
	}

	if (categoryFilter !== "all") {
		filtered = filtered.filter((t) => t.category_id === categoryFilter);
	}

	if (typeFilter) {
		filtered = filtered.filter((t) => inferTransactionType(t) === typeFilter);
	}

	const min = parseFloat(minAmount);
	const max = parseFloat(maxAmount);
	if (!isNaN(min)) {
		filtered = filtered.filter((t) => Math.abs(t.amount) >= min);
	}
	if (!isNaN(max)) {
		filtered = filtered.filter((t) => Math.abs(t.amount) <= max);
	}

	return [...filtered].sort((a, b) => {
		for (const { field, direction } of sorts) {
			const comparison = compareTransactions(a, b, field, accounts);
			if (comparison !== 0) {
				return direction === "asc" ? comparison : -comparison;
			}
		}

		// Stable tie-breaker so equal rows keep a deterministic, newest-first order.
		return new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
	});
}
