const toCents = (value: number | string | null | undefined) => Math.round(Number(value ?? 0) * 100);

/**
 * One month of interest on a positive balance, rounded to cents. `annualRate` is a fraction (0.04 for 4%).
 * Zero at or below zero: an overdrawn bank account is charged overdraft interest instead (overdraftInterest).
 */
export function monthlyInterest(balance: number | string, annualRate: number | string | null | undefined): number {
	const cents = toCents(balance);
	const rate = Number(annualRate ?? 0);
	if (cents <= 0 || !(rate > 0)) return 0;
	return Math.round((cents * rate) / 12) / 100;
}

/** Interest the account was paid. Overdraft interest is posted as a negative "interest" row and is left out. */
export function interestEarned(transactions: { transaction_type: string; amount: number }[]): number {
	const cents = transactions
		.filter((t) => t.transaction_type === "interest" && t.amount > 0)
		.reduce((sum, t) => sum + toCents(t.amount), 0);
	return cents / 100;
}
