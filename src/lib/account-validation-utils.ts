import type { AccountWithType, AccountTransaction } from "@/app/balancesheet/types";

export interface AccountStanding {
	accountClass: "asset" | "liability";
	totalAccumulatedDebt: number; // For liability accounts
	totalPayments: number; // For liability accounts
	remainingDebt: number; // For liability accounts (to date)
	availableBalance: number; // For asset accounts
	availableCredit: number; // For liability accounts (credit limit − remaining debt)
	maxAllowedTransaction: number; // Capped amount for payment or withdrawal
}

export type TransactionIntent = "income" | "expense" | "transfer";

/** Which dialog field a cap violation belongs to, so the UI can highlight it. */
export type CapViolationField = "accountId" | "fromAccountId" | "toAccountId";

export interface CapViolation {
	field: CapViolationField;
	accountId: string;
	message: string;
	maxAllowed: number;
	/** True when the explicit "Allow Overpayment" opt-in clears this violation. */
	overridable: boolean;
}

export interface CapCheckResult {
	isValid: boolean;
	violations: CapViolation[];
}

/**
 * Check if an account is an investment account. Investment accounts are ordinary assets
 * for balance-cap purposes (withdrawals are still bounded by the available balance); the
 * distinction only matters for contribution-room tracking.
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
 * Debt model for liability accounts (issue #99).
 *
 * `accounts.current_balance` is the single source of truth for how much is owed
 * (positive = debt outstanding). Ledger rows store signed amounts using the same
 * convention as the write path: for a liability a positive amount increases the debt
 * (a charge) and a negative amount reduces it (a payment, refund or transfer in).
 *
 *   remainingDebt        = max(0, current_balance)
 *   totalPayments        = Σ abs(amount) over every ledger row where amount < 0
 *   totalAccumulatedDebt = remainingDebt + totalPayments
 *
 * Because `remainingDebt` is anchored on `current_balance`, every surface (the account
 * detail card and both transaction dialogs) reports the same cap even though the dialogs
 * do not load the ledger. `totalAccumulatedDebt − totalPayments === remainingDebt` always
 * holds, so the three figures shown on the card are internally consistent.
 *
 * When no ledger is available we can only infer payments from `original_amount`
 * (never `credit_limit`, which is a spending limit, not debt).
 */
export function calculateAccountStanding(
	account: AccountWithType,
	transactions?: AccountTransaction[]
): AccountStanding {
	const accountClass = account.account_type?.class || "asset";
	const remainingDebt = accountClass === "liability" ? Math.max(0, account.current_balance) : 0;
	const availableCredit =
		accountClass === "liability"
			? account.credit_limit != null
				? Math.max(0, account.credit_limit - remainingDebt)
				: Infinity
			: 0;

	if (accountClass === "asset") {
		return {
			accountClass: "asset",
			totalAccumulatedDebt: 0,
			totalPayments: 0,
			remainingDebt: 0,
			availableBalance: account.current_balance,
			availableCredit: 0,
			maxAllowedTransaction: Math.max(0, account.current_balance),
		};
	}

	// Liability account with no ledger: infer the paid amount from the original amount.
	if (!transactions || transactions.length === 0) {
		const principal = account.original_amount ?? 0;
		const totalAccumulatedDebt = Math.max(remainingDebt, principal);
		const totalPayments = totalAccumulatedDebt - remainingDebt;

		return {
			accountClass: "liability",
			totalAccumulatedDebt,
			totalPayments,
			remainingDebt,
			availableBalance: 0,
			availableCredit,
			maxAllowedTransaction: remainingDebt,
		};
	}

	// Liability account with a ledger: debt-reducing rows are those with a negative amount.
	let totalPayments = 0;
	for (const tx of transactions) {
		if (tx.amount < 0) totalPayments += Math.abs(tx.amount);
	}
	const totalAccumulatedDebt = remainingDebt + totalPayments;

	return {
		accountClass: "liability",
		totalAccumulatedDebt,
		totalPayments,
		remainingDebt,
		availableBalance: 0,
		availableCredit,
		maxAllowedTransaction: remainingDebt,
	};
}

/**
 * Signed effect a transaction has on an account's balance, mirroring the exact
 * convention used by `createUnifiedTransaction` so client validation can never drift
 * from what the server writes.
 *
 *  - assets: deposits/contributions/refunds/interest add; everything else subtracts
 *  - liabilities: payments/refunds reduce debt; everything else increases it
 *  - transfers ignore `transactionType` and follow the account class (out of a liability
 *    is a draw, into a liability is a payment).
 */
export function calculateSignedDelta(
	account: AccountWithType,
	intent: TransactionIntent,
	transactionType: string | undefined,
	amount: number
): number {
	const abs = Math.abs(amount);
	const isAsset = account.account_type?.class !== "liability";

	if (intent === "transfer") {
		return isAsset ? -abs : abs;
	}

	const txType =
		intent === "income"
			? transactionType || (isAsset ? "deposit" : "payment")
			: transactionType || (isAsset ? "withdrawal" : "adjustment");

	if (isAsset) {
		return ["deposit", "contribution", "refund", "interest"].includes(txType) ? abs : -abs;
	}
	return ["payment", "refund"].includes(txType) ? -abs : abs;
}

interface AccountCapResult {
	ok: boolean;
	message?: string;
	maxAllowed?: number;
	overridable?: boolean;
}

/**
 * Enforce a single account's cap given the signed effect on its balance.
 *  - asset outflow        → capped at the available balance
 *  - liability decrease   → capped at the remaining debt (bypassable via overpayment)
 *  - liability increase   → capped at the available credit, when a limit is recorded
 * Investment accounts are assets and are capped like any other asset.
 */
function evaluateAccountCap(account: AccountWithType, delta: number, allowOverpayment: boolean): AccountCapResult {
	if (delta === 0) return { ok: true };

	const abs = Math.abs(delta);
	const isAsset = account.account_type?.class !== "liability";
	const balance = Math.max(0, account.current_balance);

	if (isAsset) {
		if (delta < 0 && abs > balance) {
			return {
				ok: false,
				message: `Amount ($${abs.toFixed(2)}) exceeds available account balance ($${balance.toFixed(2)}).`,
				maxAllowed: balance,
				overridable: false,
			};
		}
		return { ok: true };
	}

	if (delta < 0) {
		// Reducing debt — you cannot pay more than is owed unless overpayment is allowed.
		if (abs > balance) {
			if (allowOverpayment) return { ok: true };
			return {
				ok: false,
				message: `Amount ($${abs.toFixed(2)}) exceeds remaining debt ($${balance.toFixed(2)}).`,
				maxAllowed: balance,
				overridable: true,
			};
		}
		return { ok: true };
	}

	// Increasing debt — bounded by the available credit when a limit is known.
	if (account.credit_limit != null) {
		const availableCredit = Math.max(0, account.credit_limit - balance);
		if (abs > availableCredit) {
			return {
				ok: false,
				message: `Amount ($${abs.toFixed(2)}) exceeds available credit ($${availableCredit.toFixed(2)}).`,
				maxAllowed: availableCredit,
				overridable: false,
			};
		}
	}
	return { ok: true };
}

/**
 * Validate an amount against every account it touches. Used by both transaction dialogs
 * for live feedback and by `createUnifiedTransaction` for server-side enforcement.
 */
export function checkTransactionCaps(params: {
	intent: TransactionIntent;
	amount: number;
	account?: AccountWithType | null;
	fromAccount?: AccountWithType | null;
	toAccount?: AccountWithType | null;
	transactionType?: string;
	allowOverpayment?: boolean;
}): CapCheckResult {
	const { intent, amount, account, fromAccount, toAccount, transactionType } = params;
	const allowOverpayment = !!params.allowOverpayment;
	const violations: CapViolation[] = [];

	if (!amount || amount <= 0) return { isValid: true, violations };

	const push = (field: CapViolationField, target: AccountWithType, result: AccountCapResult) => {
		if (!result.ok) {
			violations.push({
				field,
				accountId: target.id,
				message: result.message!,
				maxAllowed: result.maxAllowed!,
				overridable: !!result.overridable,
			});
		}
	};

	if (intent === "transfer") {
		if (fromAccount) {
			const delta = calculateSignedDelta(fromAccount, "transfer", transactionType, amount);
			push("fromAccountId", fromAccount, evaluateAccountCap(fromAccount, delta, false));
		}
		if (toAccount) {
			const isAsset = toAccount.account_type?.class !== "liability";
			const delta = isAsset ? Math.abs(amount) : -Math.abs(amount);
			push("toAccountId", toAccount, evaluateAccountCap(toAccount, delta, allowOverpayment));
		}
	} else if (account) {
		const delta = calculateSignedDelta(account, intent, transactionType, amount);
		push("accountId", account, evaluateAccountCap(account, delta, allowOverpayment));
	}

	return { isValid: violations.length === 0, violations };
}
