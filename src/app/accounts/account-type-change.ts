// Pure rules for changing an account's type in Edit, shared by the dialog and updateAccount.
// Ledger rows are signed by the account's class (asset vs liability), so a type change stays
// within the class; moving between the two means adding a new account.

import { sortAccountTypes } from "@/lib/account-utils";
import { getFieldVisibility, type FieldVisibility } from "./field-visibility";
import type { Account, AccountFieldConfig, AccountType, UpdateAccountInput } from "./types";

export type AccountTypeRef = Pick<AccountType, "id" | "code" | "class" | "category" | "is_active">;

export function canChangeAccountType(from: Pick<AccountType, "class">, to: AccountTypeRef): boolean {
	return to.is_active && !!to.code && to.class === from.class;
}

/** The types offered in Edit: the current one plus every active type of the same class, "Other" last. */
export function getTypeChangeOptions<T extends AccountTypeRef & Pick<AccountType, "name">>(
	types: T[],
	current: Pick<AccountType, "id" | "class">
): T[] {
	return sortAccountTypes(types.filter((type) => type.id === current.id || canChangeAccountType(current, type)));
}

/** The "Other" field set that keeps showing what the previous type showed. */
export function toFieldConfig(visibility: FieldVisibility): AccountFieldConfig {
	return {
		showTargetGoal: visibility.showTargetGoal,
		showCreditLimit: visibility.showCreditLimit,
		showOriginalAmount: visibility.showOriginalAmount,
		showInterestRate: visibility.showInterestRate,
		showLoanTerm: visibility.showLoanTerm,
		showDueDate: visibility.showDueDate,
		showContributionRoom: visibility.showContributionRoom,
		showOverdraft: visibility.showOverdraft,
		showOverLimitFee: visibility.showOverLimitFee,
	};
}

/** The dialogs show the rate inside the credit and loan sections even when the flag is off. */
const showsInterest = (visibility: FieldVisibility) =>
	visibility.showInterestRate || visibility.showCreditLimit || visibility.showOriginalAmount;

/** Nulls every saved figure the type does not show, so it can't keep driving interest, fees, statements or room. */
export function clearHiddenFields(visibility: FieldVisibility): UpdateAccountInput {
	return {
		...(visibility.showTargetGoal ? {} : { target_balance: null }),
		...(visibility.showCreditLimit ? {} : { credit_limit: null }),
		...(visibility.showOriginalAmount ? {} : { original_amount: null }),
		...(showsInterest(visibility) ? {} : { interest_rate: null }),
		...(visibility.showLoanTerm ? {} : { loan_term_months: null }),
		...(visibility.showDueDate ? {} : { payment_due_date: null }),
		...(visibility.showStatementDay ? {} : { statement_day: null }),
		...(visibility.showOverdraft
			? {}
			: {
					overdraft_protection: false,
					overdraft_limit: null,
					overdraft_fee: null,
					nsf_fee: null,
					overdraft_interest_rate: null,
				}),
		...(visibility.showOverLimitFee ? {} : { over_limit_fee: null }),
		...(visibility.showContributionRoom
			? {}
			: {
					track_contribution_room: false,
					contribution_plan: null,
					contribution_room: null,
					contribution_room_as_of: null,
					annual_contribution_limit: null,
				}),
	};
}

/**
 * The update to save when the type may have changed, or null when the change is not allowed.
 * An unchanged type passes the input through untouched.
 */
export function applyTypeChange(
	input: UpdateAccountInput,
	from: AccountTypeRef,
	to: AccountTypeRef | null | undefined
): UpdateAccountInput | null {
	if (!to) return null;
	if (to.id === from.id) return input;
	if (!canChangeAccountType(from, to)) return null;

	const config =
		to.code === "other" ? (input.field_visibility ?? toFieldConfig(getFieldVisibility(from, null))) : null;
	return {
		...input,
		...clearHiddenFields(getFieldVisibility(to, config)),
		account_type_id: to.id,
		field_visibility: config,
	};
}

const isInvestmentType = (type: Pick<AccountType, "code" | "category">) =>
	type.code === "investment" || type.category === "investment" || (type.category as string) === "retirement";

export function isMovingIntoInvestment(from: AccountTypeRef, to: AccountTypeRef): boolean {
	return isInvestmentType(to) && !isInvestmentType(from);
}

const CLEARED_FIELD_LABELS: [keyof Account, string][] = [
	["target_balance", "target goal"],
	["credit_limit", "credit limit"],
	["original_amount", "original amount"],
	["interest_rate", "interest rate"],
	["loan_term_months", "loan term"],
	["payment_due_date", "payment due date"],
	["statement_day", "statement day"],
	["overdraft_protection", "overdraft protection"],
	["nsf_fee", "NSF fee"],
	["over_limit_fee", "over-limit fee"],
	["track_contribution_room", "contribution room tracking"],
];

/** Plain notes on what switching this account to the new type changes, for the Edit dialog. */
export function describeTypeChange(
	account: Partial<Account>,
	from: AccountTypeRef,
	to: AccountTypeRef,
	toVisibility: FieldVisibility
): string[] {
	if (to.id === from.id) return [];
	const notes: string[] = [];

	// Moving in, the balance field's own label and hint explain "amount deposited".
	if (isMovingIntoInvestment(from, to)) {
		notes.push("Investment accounts don't have account fees, so any set up here stop.");
	} else if (isInvestmentType(from) && !isInvestmentType(to)) {
		notes.push("The balance was the amount deposited. Update it to what's in the account now.");
	}

	const cleared = clearHiddenFields(toVisibility);
	const lost = CLEARED_FIELD_LABELS.filter(([key]) => {
		const value = account[key];
		return key in cleared && value !== null && value !== undefined && value !== false;
	}).map(([, label]) => label);
	if (lost.length > 0) {
		const list = lost.length === 1 ? lost[0] : `${lost.slice(0, -1).join(", ")} and ${lost[lost.length - 1]}`;
		notes.push(`Clears the saved ${list}.`);
	}

	return notes;
}
