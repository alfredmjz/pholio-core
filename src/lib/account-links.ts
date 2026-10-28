import type { AccountWithType } from "@/app/accounts/types";

type AccountStandingFields = Pick<AccountWithType, "current_balance" | "credit_limit"> & {
	account_type?: { class?: string | null } | null;
};

/** Allocations for the month of `date` (YYYY-MM-DD), opening `transactionId` when given. */
export function allocationsHref(date: string, transactionId?: string): string {
	const [year, month] = date.slice(0, 10).split("-");
	const params = new URLSearchParams({ year: String(Number(year)), month: String(Number(month)) });
	if (transactionId) params.set("transaction", transactionId);
	return `/allocations?${params.toString()}`;
}

export function accountHref(accountId: string): string {
	return `/accounts/${accountId}`;
}

/**
 * Whether a transfer leg sent money to the other account or received it. A transfer out lowers an
 * asset (negative amount) and raises a liability's debt (positive amount, e.g. a cash advance).
 */
export function transferDirection(amount: number, isLiability: boolean): "to" | "from" {
	const isOut = isLiability ? amount > 0 : amount < 0;
	return isOut ? "to" : "from";
}

/**
 * Why an account a recurring item is paid from needs attention: an asset below zero, or a
 * liability whose debt is past its credit limit. Null when it is fine or the limit is unknown.
 */
export function accountWarning(account: AccountStandingFields): "below_zero" | "past_limit" | null {
	const balance = Number(account.current_balance);
	if (account.account_type?.class === "liability") {
		return account.credit_limit != null && balance > Number(account.credit_limit) ? "past_limit" : null;
	}
	return balance < 0 ? "below_zero" : null;
}

export function accountWarningText(warning: "below_zero" | "past_limit", accountLabel: string): string {
	return warning === "below_zero" ? `${accountLabel} is below zero` : `${accountLabel} is past its credit limit`;
}
