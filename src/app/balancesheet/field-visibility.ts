import type { AccountCategory } from "./types";

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

/**
 * Determines which fields are visible for a given account category and type name.
 *
 * For the "credit" category, Line of Credit has different field rules than Credit Card:
 * - Credit Card: Credit Limit, Due Date, APR, Institution
 * - Line of Credit: Credit Limit, APR, Institution (no Due Date)
 */
export function getFieldVisibility(category: AccountCategory | undefined, typeName?: string): FieldVisibility {
	const isLineOfCredit = category === "credit" && typeName?.toLowerCase().includes("line of credit");

	switch (category) {
		case "credit":
			return {
				showTargetGoal: false,
				showCreditLimit: true,
				showOriginalAmount: false,
				showInterestRate: true,
				showLoanTerm: false,
				showDueDate: !isLineOfCredit,
				showContributionRoom: false,
				interestRateLabel: "APR (%)",
				institutionLabel: isLineOfCredit ? "Institution" : "Institution/Lender",
				institutionPlaceholder: isLineOfCredit ? "TD, RBC, etc." : "Chase, Amex, etc.",
			};

		case "debt":
			return {
				showTargetGoal: false,
				showCreditLimit: false,
				showOriginalAmount: true,
				showInterestRate: true,
				showLoanTerm: true,
				showDueDate: true,
				showContributionRoom: false,
				interestRateLabel: "APR (%)",
				institutionLabel: "Lender",
				institutionPlaceholder: "Bank of America, etc.",
			};

		case "investment":
		case "retirement":
			return {
				showTargetGoal: false,
				showCreditLimit: false,
				showOriginalAmount: false,
				showInterestRate: false,
				showLoanTerm: false,
				showDueDate: false,
				showContributionRoom: true,
				interestRateLabel: "APY (%)",
				institutionLabel: "Institution/Brokerage",
				institutionPlaceholder: "Wealthsimple, Questrade, etc.",
			};

		// banking, property, other, undefined
		default:
			return {
				showTargetGoal: true,
				showCreditLimit: false,
				showOriginalAmount: false,
				showInterestRate: true,
				showLoanTerm: false,
				showDueDate: false,
				showContributionRoom: false,
				interestRateLabel: "APY (%)",
				institutionLabel: "Institution",
				institutionPlaceholder: "Chase, Ally Bank, etc.",
			};
	}
}
