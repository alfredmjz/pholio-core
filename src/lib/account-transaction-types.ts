import type { TransactionType } from "@/app/balancesheet/types";

export interface AccountTransactionTypeOption {
	value: TransactionType;
	label: string;
}

/**
 * Account transaction types offered for an income or expense, by account class.
 * On a liability, income reduces the debt (payment, refund) and an expense adds to it
 * (a charge is stored as `adjustment`, the liability default in calculateTransactionDetails).
 * Each list is in alphabetical order of its label (ADR-003).
 */
const ACCOUNT_TRANSACTION_TYPE_OPTIONS: Record<
	"asset" | "liability",
	Record<"income" | "expense", AccountTransactionTypeOption[]>
> = {
	asset: {
		income: [
			{ value: "contribution", label: "➕ Contribution" },
			{ value: "deposit", label: "💰 Deposit" },
			{ value: "refund", label: "🔄 Refund" },
		],
		expense: [
			{ value: "interest", label: "📈 Interest" },
			{ value: "payment", label: "💳 Payment" },
			{ value: "withdrawal", label: "💸 Withdrawal" },
		],
	},
	liability: {
		income: [
			{ value: "payment", label: "💳 Payment" },
			{ value: "refund", label: "🔄 Refund" },
		],
		expense: [
			{ value: "interest", label: "📈 Interest" },
			{ value: "adjustment", label: "🛒 Purchase / Charge" },
		],
	},
};

/** Types an account starts on: deposit/withdrawal on assets, payment/charge on liabilities. */
const DEFAULT_ACCOUNT_TRANSACTION_TYPE: Record<"asset" | "liability", Record<"income" | "expense", TransactionType>> = {
	asset: { income: "deposit", expense: "withdrawal" },
	liability: { income: "payment", expense: "adjustment" },
};

export function getAccountTransactionTypeOptions(
	isLiability: boolean,
	intent: "income" | "expense"
): AccountTransactionTypeOption[] {
	return ACCOUNT_TRANSACTION_TYPE_OPTIONS[isLiability ? "liability" : "asset"][intent];
}

export function getDefaultAccountTransactionType(isLiability: boolean, intent: "income" | "expense"): TransactionType {
	return DEFAULT_ACCOUNT_TRANSACTION_TYPE[isLiability ? "liability" : "asset"][intent];
}
