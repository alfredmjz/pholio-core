import type { AccountTransaction } from "@/app/accounts/types";

// Pholio has no broker feed, so an investment account's balance is what went in, not its market value.
export const INVESTMENT_BALANCE_LABEL = "Amount deposited";
export const INVESTMENT_BALANCE_HINT = "What you've put in, less withdrawals. Not the market value.";

export interface InvestmentFlows {
	deposited: number;
	withdrawn: number;
	/** deposited − withdrawn: how far these rows moved the balance. */
	net: number;
}

/**
 * Money in and out of an investment account over the given ledger rows. Rows are signed the
 * way the balance moves (deposits, contributions and transfers in are positive), so `net` is
 * exactly what the rows added to the amount deposited. Summed in cents to avoid float drift.
 */
export function summarizeInvestmentFlows(transactions: Pick<AccountTransaction, "amount">[]): InvestmentFlows {
	let depositedCents = 0;
	let withdrawnCents = 0;
	for (const { amount } of transactions) {
		const cents = Math.round(Number(amount) * 100);
		if (cents > 0) depositedCents += cents;
		else withdrawnCents -= cents;
	}
	return {
		deposited: depositedCents / 100,
		withdrawn: withdrawnCents / 100,
		net: (depositedCents - withdrawnCents) / 100,
	};
}
