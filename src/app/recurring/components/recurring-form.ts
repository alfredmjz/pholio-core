import { formatDateString, formatPeriod, parseLocalDate, parsePeriod, type PeriodUnit } from "@/lib/date-utils";
import type { AccountWithType } from "@/app/accounts/types";
import type { RecurringExpense } from "../actions";

export const NO_ACCOUNT = "__none__";
export const DEFAULT_BUDGET_CATEGORY = "__default__";

/**
 * For a transfer, `account_id` is the source account and `to_account_id` the destination. For a
 * bill, `to_account_id` is the debt it pays down ("" for none).
 */
export interface RecurringFormValues {
	name: string;
	amount: string;
	frequency_value: string;
	frequency_unit: string;
	next_due_date: Date;
	category: string;
	budget_category: string;
	account_id: string;
	to_account_id: string;
	is_automated: boolean;
}

export function emptyRecurringForm(now: Date = new Date()): RecurringFormValues {
	return {
		name: "",
		amount: "",
		frequency_value: "1",
		frequency_unit: "months",
		next_due_date: now,
		category: "subscription",
		budget_category: DEFAULT_BUDGET_CATEGORY,
		account_id: NO_ACCOUNT,
		to_account_id: "",
		is_automated: true,
	};
}

/** `reactivating` starts the due date today, since a paused item's old date is in the past. */
export function expenseToForm(
	expense: RecurringExpense,
	{ reactivating = false, now = new Date() }: { reactivating?: boolean; now?: Date } = {}
): RecurringFormValues {
	const { value, unit } = parsePeriod(expense.billing_period);
	return {
		name: expense.name,
		amount: String(expense.amount),
		frequency_value: String(value),
		frequency_unit: unit,
		next_due_date: reactivating ? now : parseLocalDate(expense.next_due_date),
		category: expense.category,
		budget_category: expense.budget_category ?? DEFAULT_BUDGET_CATEGORY,
		account_id: expense.account_id ?? (expense.category === "transfer" ? "" : NO_ACCOUNT),
		to_account_id: expense.to_account_id ?? "",
		is_automated: (expense.meta_data as { is_automated?: boolean } | null)?.is_automated !== false,
	};
}

/** Accounts a bill or subscription can be paid from: not a mortgage or loan, which only take payments. */
export function canPayBillsFrom(account: Pick<AccountWithType, "account_type">): boolean {
	const code = account.account_type?.code;
	return code !== "mortgage" && code !== "loan";
}

/** Accounts a bill can pay down: any debt (credit card, line of credit, loan, mortgage, other liability). */
export function canPayDown(account: Pick<AccountWithType, "account_type">): boolean {
	return account.account_type?.class === "liability";
}

/** The message for a transfer whose accounts aren't ready, or null when they are. */
export function transferAccountsError(fromAccountId: string, toAccountId: string): string | null {
	if (!fromAccountId || !toAccountId) return "Choose the account the money comes from and the one it goes to.";
	if (fromAccountId === toAccountId) return "The two accounts must be different.";
	return null;
}

export type RecurringFormValidation =
	{ ok: true; amount: number; frequencyValue: number } | { ok: false; title: string; description: string };

export function validateRecurringForm(form: RecurringFormValues): RecurringFormValidation {
	const fail = (title: string, description: string): RecurringFormValidation => ({ ok: false, title, description });

	if (!form.name.trim()) return fail("Name is required", "Please enter a name for this recurring expense.");
	if (!form.amount) return fail("Amount is required", "Please enter an amount for this recurring expense.");
	if (!/^\d+(\.\d{1,2})?$/.test(form.amount)) {
		return fail("Invalid amount", "Please enter a valid number with up to 2 decimal places (e.g., 9.99).");
	}
	const amount = parseFloat(form.amount);
	if (amount <= 0) return fail("Invalid amount", "Amount must be greater than zero.");

	// The field may be empty while typing; it only has to be a whole number of at least 1 on submit.
	const frequencyValue = parseInt(form.frequency_value, 10);
	if (!(frequencyValue >= 1)) return fail("Invalid frequency", "Frequency must be a whole number of at least 1.");

	if (form.category === "transfer") {
		const accountsError = transferAccountsError(form.account_id, form.to_account_id);
		if (accountsError) return fail("Choose two accounts", accountsError);
	} else if (form.category === "bill" && form.to_account_id && form.to_account_id === form.account_id) {
		return fail("Choose two accounts", "A bill can't be paid from the debt it pays down.");
	}

	return { ok: true, amount, frequencyValue };
}

/** The columns both dialogs save. A valid form is required: call after `validateRecurringForm`. */
export function formToPayload(
	form: RecurringFormValues,
	valid: { amount: number; frequencyValue: number }
): Pick<
	RecurringExpense,
	| "name"
	| "amount"
	| "billing_period"
	| "next_due_date"
	| "category"
	| "budget_category"
	| "account_id"
	| "to_account_id"
> {
	const isTransfer = form.category === "transfer";
	const paysDown = isTransfer || form.category === "bill";
	return {
		name: form.name,
		amount: valid.amount,
		billing_period: formatPeriod({ value: valid.frequencyValue, unit: form.frequency_unit as PeriodUnit }),
		next_due_date: formatDateString(form.next_due_date),
		category: form.category,
		budget_category: isTransfer || form.budget_category === DEFAULT_BUDGET_CATEGORY ? null : form.budget_category,
		account_id: form.account_id === NO_ACCOUNT ? null : form.account_id,
		to_account_id: paysDown && form.to_account_id ? form.to_account_id : null,
	};
}
