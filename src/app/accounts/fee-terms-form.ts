// Pure helpers for the bank-fee fields of the Add/Edit Account dialogs (FeeTermsFields), kept
// free of React so they can be unit tested. Rates are typed as percentages and stored as fractions,
// like interest_rate.

import type { FieldVisibility } from "./field-visibility";
import type { Account, CreateAccountInput } from "./types";

export interface FeeTermsFormValues {
	overdraft_protection: boolean;
	overdraft_limit: string;
	overdraft_fee: string;
	nsf_fee: string;
	overdraft_interest_rate: string;
	over_limit_fee: string;
}

export type FeeTermsInput = Pick<
	CreateAccountInput,
	| "overdraft_protection"
	| "overdraft_limit"
	| "overdraft_fee"
	| "nsf_fee"
	| "overdraft_interest_rate"
	| "over_limit_fee"
>;

export const EMPTY_FEE_TERMS_VALUES: FeeTermsFormValues = {
	overdraft_protection: false,
	overdraft_limit: "",
	overdraft_fee: "",
	nsf_fee: "",
	overdraft_interest_rate: "",
	over_limit_fee: "",
};

const toField = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
const toAmount = (value: string) => {
	const parsed = parseFloat(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function toFeeTermsValues(account: Partial<Account>): FeeTermsFormValues {
	const rate = account.overdraft_interest_rate;
	return {
		overdraft_protection: !!account.overdraft_protection,
		overdraft_limit: toField(account.overdraft_limit),
		overdraft_fee: toField(account.overdraft_fee),
		nsf_fee: toField(account.nsf_fee),
		overdraft_interest_rate: rate ? String(Math.round(rate * 1_000_000) / 10_000) : "",
		over_limit_fee: toField(account.over_limit_fee),
	};
}

/** What to save. Fields the type does not show, and protection-only fields when it is off, are cleared. */
export function toFeeTermsInput(values: FeeTermsFormValues, visibility: FieldVisibility): FeeTermsInput {
	const overdraft = visibility.showOverdraft;
	const isProtected = overdraft && values.overdraft_protection;
	const rate = toAmount(values.overdraft_interest_rate);
	return {
		overdraft_protection: isProtected,
		overdraft_limit: isProtected ? toAmount(values.overdraft_limit) : null,
		overdraft_fee: isProtected ? toAmount(values.overdraft_fee) : null,
		overdraft_interest_rate: isProtected && rate ? Math.round(rate * 100) / 10_000 : null,
		nsf_fee: overdraft ? toAmount(values.nsf_fee) : null,
		over_limit_fee: visibility.showOverLimitFee ? toAmount(values.over_limit_fee) : null,
	};
}
