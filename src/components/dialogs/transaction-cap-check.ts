import type { AccountWithType } from "@/app/accounts/types";
import type { Transaction } from "@/app/allocations/types";
import { accountBeforeSavedRow } from "@/app/allocations/utils/transfer-accounts";
import { checkTransactionCaps } from "@/lib/account-validation-utils";

type CapCheckResult = ReturnType<typeof checkTransactionCaps>;

/** The dialogs' "none" select value, as the null the actions expect. */
export function noneToNull(id: string | null | undefined): string | null {
	return !id || id === "none" ? null : id;
}

/**
 * Cap check for a dialog's current inputs. Pass `savedRow` when editing: the check then runs
 * against the balance without that row's own amount, and a recurring row is never capped.
 * `accountId` is only used for non-transfers; a transfer reads `fromId` and `toId`.
 */
export function transactionCapCheck(params: {
	type: "income" | "expense" | "transfer";
	amount: number;
	accountId?: string | null;
	fromId?: string | null;
	toId?: string | null;
	accounts: AccountWithType[];
	transactionType?: string;
	savedRow?: Transaction | null;
}): CapCheckResult {
	const { type, amount, accounts, savedRow } = params;
	if (!(amount > 0) || savedRow?.recurring_expense_id) return { isValid: true, violations: [] };
	const find = (id: string | null | undefined) =>
		accountBeforeSavedRow(
			accounts.find((a) => a.id === id),
			savedRow
		);
	return checkTransactionCaps({
		intent: type,
		amount,
		account: type === "transfer" ? null : find(params.accountId),
		fromAccount: type === "transfer" ? find(params.fromId) : null,
		toAccount: type === "transfer" ? find(params.toId) : null,
		transactionType: params.transactionType,
	});
}
