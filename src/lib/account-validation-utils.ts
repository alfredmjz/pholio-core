import type { AccountWithType, AccountTransaction } from "@/app/balancesheet/types";
import { getTodayDateString } from "@/lib/date-utils";

export interface AccountStanding {
	isExempt: boolean; // true for investment accounts
	accountClass: "asset" | "liability";
	totalAccumulatedDebt: number; // For liability accounts
	totalPayments: number; // For liability accounts
	remainingDebt: number; // For liability accounts (to date)
	availableBalance: number; // For asset accounts
	maxAllowedTransaction: number; // Capped amount for payment or withdrawal
}

/**
 * Check if an account is an investment account (exempt from debt/balance checks)
 */
export function isInvestmentAccount(
	account?: { account_type?: { code?: string | null; category?: string | null } | null } | null
): boolean {
	if (!account) return false;
	// The account type is the single source of truth. Account and type names are display
	// labels only and must never influence behaviour.
	const code = account.account_type?.code ?? null;
	if (code === "investment") return true;
	const category = account.account_type?.category ?? null;
	// "retirement" only exists on legacy rows awaiting the guided type migration.
	return category === "investment" || category === "retirement";
}

/**
 * Calculate total accumulated debt up to today's date minus payments made
 */
export function calculateAccountStanding(
	account: AccountWithType,
	transactions?: AccountTransaction[],
	asOfDate: string = getTodayDateString()
): AccountStanding {
	const accountClass = account.account_type?.class || "asset";
	const isExempt = isInvestmentAccount(account);

	if (isExempt) {
		return {
			isExempt: true,
			accountClass,
			totalAccumulatedDebt: 0,
			totalPayments: 0,
			remainingDebt: 0,
			availableBalance: account.current_balance,
			maxAllowedTransaction: Infinity,
		};
	}

	if (accountClass === "asset") {
		return {
			isExempt: false,
			accountClass: "asset",
			totalAccumulatedDebt: 0,
			totalPayments: 0,
			remainingDebt: 0,
			availableBalance: account.current_balance,
			maxAllowedTransaction: Math.max(0, account.current_balance),
		};
	}

	// Liability Account calculation
	if (!transactions || transactions.length === 0) {
		const baseOriginal = account.original_amount ?? account.credit_limit ?? account.current_balance;
		const remainingDebt = Math.max(0, account.current_balance);
		const totalAccumulatedDebt = Math.max(baseOriginal, remainingDebt);
		const totalPayments = Math.max(0, totalAccumulatedDebt - remainingDebt);

		return {
			isExempt: false,
			accountClass: "liability",
			totalAccumulatedDebt,
			totalPayments,
			remainingDebt,
			availableBalance: 0,
			maxAllowedTransaction: remainingDebt,
		};
	}

	// Filter transactions up to asOfDate
	const validTxs = transactions.filter((t) => {
		const txDate = t.transaction_date.split("T")[0];
		return txDate <= asOfDate;
	});

	let totalPayments = 0;
	let accumulatedCharges = 0;

	validTxs.forEach((t) => {
		const type = t.transaction_type;
		const absAmount = Math.abs(t.amount);

		if (type === "payment" || type === "refund") {
			totalPayments += absAmount;
		} else if (type === "withdrawal" || type === "interest" || type === "adjustment" || type === "deposit") {
			accumulatedCharges += absAmount;
		} else {
			if (t.amount < 0) {
				totalPayments += absAmount;
			} else {
				accumulatedCharges += absAmount;
			}
		}
	});

	const initialPrincipal = account.original_amount ?? account.credit_limit ?? 0;
	const totalAccumulatedDebt = Math.max(initialPrincipal + accumulatedCharges, account.current_balance + totalPayments);
	const remainingDebt = Math.max(0, totalAccumulatedDebt - totalPayments);

	return {
		isExempt: false,
		accountClass: "liability",
		totalAccumulatedDebt,
		totalPayments,
		remainingDebt,
		availableBalance: 0,
		maxAllowedTransaction: remainingDebt,
	};
}

/**
 * Validate transaction amount against account balance or remaining debt
 */
export function validateTransactionAmount(
	account: AccountWithType,
	amount: number,
	txIntent: "income" | "expense" | "transfer" | "payment" | "withdrawal",
	standing: AccountStanding
): { isValid: boolean; warning?: string; maxAllowed?: number } {
	if (standing.isExempt) {
		return { isValid: true };
	}

	if (account.account_type?.class === "liability") {
		// Payments / debt reductions
		if (txIntent === "income" || txIntent === "payment" || txIntent === "transfer") {
			if (amount > standing.remainingDebt && standing.remainingDebt > 0) {
				return {
					isValid: false,
					warning: `Amount ($${amount.toFixed(2)}) exceeds remaining debt ($${standing.remainingDebt.toFixed(2)}) as of today.`,
					maxAllowed: standing.remainingDebt,
				};
			}
		}
	} else if (account.account_type?.class === "asset") {
		// Withdrawals / expenses / transfers out
		if (txIntent === "expense" || txIntent === "withdrawal" || txIntent === "transfer") {
			if (amount > standing.availableBalance) {
				return {
					isValid: false,
					warning: `Amount ($${amount.toFixed(2)}) exceeds available account balance ($${standing.availableBalance.toFixed(2)}).`,
					maxAllowed: standing.availableBalance,
				};
			}
		}
	}

	return { isValid: true };
}
