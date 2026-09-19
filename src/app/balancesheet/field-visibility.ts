import type { AccountCategory, AccountFieldConfig, AccountTypeCode } from "./types";

export interface FieldVisibility {
	showTargetGoal: boolean;
	showCreditLimit: boolean;
	showOriginalAmount: boolean;
	showInterestRate: boolean;
	showLoanTerm: boolean;
	showDueDate: boolean;
	showContributionRoom: boolean;
	interestRateLabel: string;
	institutionLabel: string;
	institutionPlaceholder: string;
}

export type CoreAccountTypeCode = Exclude<AccountTypeCode, "other">;

function preset(overrides: Partial<FieldVisibility>): FieldVisibility {
	return {
		showTargetGoal: false,
		showCreditLimit: false,
		showOriginalAmount: false,
		showInterestRate: false,
		showLoanTerm: false,
		showDueDate: false,
		showContributionRoom: false,
		interestRateLabel: "Interest Rate (%)",
		institutionLabel: "Institution",
		institutionPlaceholder: "Bank, lender, brokerage, etc.",
		...overrides,
	};
}

/**
 * Fixed field presets for the seven core account types. Selection is driven by the
 * type stable `code`, never by its display name.
 */
export const CORE_TYPE_PRESETS: Record<CoreAccountTypeCode, FieldVisibility> = {
	chequing: preset({}),
	savings: preset({ showTargetGoal: true, showInterestRate: true, interestRateLabel: "APY (%)" }),
	investment: preset({
		showContributionRoom: true,
		interestRateLabel: "Yield (%)",
		institutionLabel: "Brokerage / Institution",
		institutionPlaceholder: "Wealthsimple, Vanguard, Fidelity, etc.",
	}),
	credit_card: preset({
		showCreditLimit: true,
		showInterestRate: true,
		showDueDate: true,
		institutionLabel: "Credit Card Issuer",
		institutionPlaceholder: "Chase, Amex, Capital One, etc.",
	}),
	line_of_credit: preset({
		showCreditLimit: true,
		showInterestRate: true,
		interestRateLabel: "Variable APR (%)",
		institutionLabel: "Lender / Institution",
		institutionPlaceholder: "TD, RBC, Scotiabank, etc.",
	}),
	mortgage: preset({
		showOriginalAmount: true,
		showInterestRate: true,
		showLoanTerm: true,
		showDueDate: true,
		interestRateLabel: "Mortgage Rate (%)",
		institutionLabel: "Lender",
		institutionPlaceholder: "Bank of America, Rocket Mortgage, etc.",
	}),
	loan: preset({
		showOriginalAmount: true,
		showInterestRate: true,
		showLoanTerm: true,
		showDueDate: true,
		interestRateLabel: "APR (%)",
		institutionLabel: "Lender",
		institutionPlaceholder: "Navient, Marcus, SoFi, etc.",
	}),
};

/**
 * Temporary bridge for accounts whose type has no `code` yet (retired by migration 006,
 * awaiting the owner re-selection). It renders the fields their stored category exposed
 * before so no entered data is hidden, and never inspects type or account names.
 */
function legacyCategoryVisibility(category: AccountCategory | null | undefined): FieldVisibility {
	switch (category as string | null | undefined) {
		case "investment":
		case "retirement":
			return CORE_TYPE_PRESETS.investment;
		case "credit":
			return CORE_TYPE_PRESETS.credit_card;
		case "debt":
			return CORE_TYPE_PRESETS.loan;
		default:
			return preset({ showTargetGoal: true, showInterestRate: true, interestRateLabel: "APY (%)" });
	}
}

/**
 * Field visibility for the fully-customisable "Other" account type.
 */
export function customFieldVisibility(config?: AccountFieldConfig | null): FieldVisibility {
	return preset({
		showTargetGoal: config?.showTargetGoal ?? false,
		showCreditLimit: config?.showCreditLimit ?? false,
		showOriginalAmount: config?.showOriginalAmount ?? false,
		showInterestRate: config?.showInterestRate ?? false,
		showLoanTerm: config?.showLoanTerm ?? false,
		showDueDate: config?.showDueDate ?? false,
		showContributionRoom: config?.showContributionRoom ?? false,
	});
}

/**
 * Resolves which fields an account should render:
 * - core codes use a fixed preset
 * - "other" uses the owner per-account configuration
 * - types without a code use the legacy bridge above
 */
export function getFieldVisibility(
	type?: { code?: AccountTypeCode | null; category?: AccountCategory | null } | null,
	customConfig?: AccountFieldConfig | null
): FieldVisibility {
	const code = type?.code ?? null;
	if (code === "other") return customFieldVisibility(customConfig);
	if (code) return CORE_TYPE_PRESETS[code as CoreAccountTypeCode];
	return legacyCategoryVisibility(type?.category);
}
