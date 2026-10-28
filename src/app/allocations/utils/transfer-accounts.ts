import type { AccountWithType } from "@/app/accounts/types";
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

/**
 * The account as it stood before a saved row changed it, so an edit is capped against the balance
 * without its own amount. A transfer's destination leg is the opposite of its source leg.
 */
export function accountBeforeSavedRow<T extends AccountWithType | null | undefined>(
	account: T,
	transaction: Transaction | null | undefined
): T {
	if (!account || !transaction) return account;
	const sourceLeg = transaction.linked_account_transaction;
	let legAmount = 0;
	if (sourceLeg?.account_id === account.id) {
		legAmount = Number(sourceLeg.amount);
	} else if (transaction.source === "transfer" && getTransferAccountIds(transaction).toAccountId === account.id) {
		const isAsset = account.account_type?.class !== "liability";
		legAmount = isAsset ? Math.abs(transaction.amount) : -Math.abs(transaction.amount);
	}
	return legAmount === 0 ? account : { ...account, current_balance: Number(account.current_balance) - legAmount };
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
