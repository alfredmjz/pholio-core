import type { Transaction } from "../types";

/**
 * Resolve the source and destination accounts of a transfer. The budget row links to the
 * source leg; the destination is the other account transaction linked to the same row.
 */
export function getTransferAccountIds(transaction: Transaction): {
	fromAccountId: string | null;
	toAccountId: string | null;
} {
	const linked = transaction.linked_account_transactions ?? [];
	const sourceTxId = transaction.linked_account_transaction?.id;
	const fromAccountId = transaction.linked_account_transaction?.account_id ?? transaction.account_id ?? null;
	const toAccountId =
		linked.find((entry) => entry.id !== sourceTxId && entry.account_id !== fromAccountId)?.account_id ?? null;

	return { fromAccountId, toAccountId };
}

/** The accounts a budget row touches: source then destination for a transfer, else its one account. */
export function getLinkedAccountIds(transaction: Transaction): string[] {
	if (transaction.source === "transfer") {
		const { fromAccountId, toAccountId } = getTransferAccountIds(transaction);
		return [fromAccountId, toAccountId].filter((id): id is string => !!id);
	}
	const accountId = transaction.account_id ?? transaction.linked_account_transaction?.account_id ?? null;
	return accountId ? [accountId] : [];
}
