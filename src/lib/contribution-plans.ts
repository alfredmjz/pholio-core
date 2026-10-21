import type { ContributionPlan, RegisteredPlan } from "@/app/balancesheet/types";
import type { ContributionSummary } from "@/lib/types/contribution";
import { parseLocalDate } from "@/lib/date-utils";

/** CRA My Account: the only place an individual can see their official contribution room. */
export const CRA_MY_ACCOUNT_URL =
	"https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/account-individuals.html";

/** CRA lets RRSP holders go over their deduction limit by up to $2,000 without the 1% tax. */
const RRSP_OVER_CONTRIBUTION_BUFFER = 2000;

/** Share of available room that triggers the "approaching" notice. */
const APPROACHING_THRESHOLD = 0.9;

export interface ContributionPlanOption {
	value: ContributionPlan;
	label: string;
	description: string;
}

/** Plans in alphabetical order (ADR-003), with "Other" last like the account-type list. */
export const CONTRIBUTION_PLAN_OPTIONS: ContributionPlanOption[] = [
	{
		value: "fhsa",
		label: "FHSA",
		description: "$8,000 a year, $40,000 lifetime. Enter your participation room from CRA.",
	},
	{
		value: "resp",
		label: "RESP",
		description: "$50,000 lifetime per beneficiary. Enter the room you have left.",
	},
	{
		value: "rrsp",
		label: "RRSP",
		description: "Enter your deduction limit from your Notice of Assessment or CRA My Account.",
	},
	{
		value: "tfsa",
		label: "TFSA",
		description: "Room rolls forward each January with the new CRA limit and last year's withdrawals.",
	},
	{
		value: "other",
		label: "Other",
		description: "Uses only the room and annual limit you enter.",
	},
];

/** Registered plans in alphabetical order (ADR-003); their room is shared across accounts. */
export const REGISTERED_PLANS: RegisteredPlan[] = ["fhsa", "resp", "rrsp", "tfsa"];

export function isRegisteredPlan(plan: ContributionPlan | string | null | undefined): plan is RegisteredPlan {
	return REGISTERED_PLANS.includes(plan as RegisteredPlan);
}

/**
 * CRA's own name for a plan's room figure: TFSA "contribution room", RRSP "deduction limit",
 * FHSA "participation room". Used in every message so the wording matches CRA's.
 */
export function getRoomTerm(plan: ContributionPlan | null | undefined): string {
	switch (plan) {
		case "tfsa":
			return "TFSA contribution room";
		case "rrsp":
			return "RRSP deduction limit";
		case "fhsa":
			return "FHSA participation room";
		case "resp":
			return "RESP contribution room";
		default:
			return "contribution room";
	}
}

/** Card heading for a plan's room, in title case: "RRSP Deduction Limit". */
export function getRoomTitle(plan: ContributionPlan | null | undefined): string {
	const term = getRoomTerm(plan);
	return term.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/** A sentence-start version of the room term: "RRSP deduction limit" / "Contribution room". */
export function capitalizeRoomTerm(plan: ContributionPlan | null | undefined): string {
	const term = getRoomTerm(plan);
	return term.charAt(0).toUpperCase() + term.slice(1);
}

export function getContributionPlanLabel(plan: ContributionPlan | null | undefined): string {
	return CONTRIBUTION_PLAN_OPTIONS.find((option) => option.value === plan)?.label ?? "Investment";
}

/**
 * Formatting for contribution figures. CRA tracks contribution room to the cent, so cents
 * are always shown.
 */
export function formatContributionAmount(amount: number, currency = "CAD"): string {
	return new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

export type ContributionNoticeLevel = "exceeded" | "warning" | "info";

export interface ContributionNotice {
	level: ContributionNoticeLevel;
	message: string;
}

/** CRA's over-contribution tax rate: 1% of the excess for each month it lasts. */
const MONTHLY_TAX_RATE = 0.01;

/**
 * Estimated CRA tax for one month on an excess of `excess`. Used to preview what a deposit
 * would add; the tax actually accrued comes from the database (contribution_room_walk).
 * RRSP is taxed only above the $2,000 buffer; "Other" accounts have no CRA tax.
 */
export function estimateMonthlyOverContributionTax(plan: ContributionPlan | null, excess: number): number {
	if (!isRegisteredPlan(plan) || excess <= 0) return 0;
	const taxable = plan === "rrsp" ? Math.max(0, excess - RRSP_OVER_CONTRIBUTION_BUFFER) : excess;
	return Math.round(taxable * MONTHLY_TAX_RATE * 100) / 100;
}

/**
 * Plain-language notices for a contribution summary. `pendingAmount` is a deposit the user is
 * about to record, so dialogs can warn before saving. Notices never block a transaction.
 * The figures themselves come from the database; this only compares them.
 */
export function getContributionNotices(
	summary: ContributionSummary | null | undefined,
	formatCurrency: (amount: number) => string,
	pendingAmount = 0
): ContributionNotice[] {
	if (!summary?.tracks_room) return [];

	const notices: ContributionNotice[] = [];
	const plan = summary.contribution_plan;
	const planLabel = getContributionPlanLabel(plan);
	const roomTerm = getRoomTerm(plan);
	const pending = Math.max(0, pendingAmount);

	let roomExceeded = false;
	if (summary.room_remaining !== null) {
		const roomAfter = summary.room_remaining - pending;
		const available = (summary.room_entered ?? 0) + (summary.room_added ?? 0);

		if (roomAfter < 0) {
			roomExceeded = true;
			const over = Math.abs(roomAfter);
			const monthlyTax = estimateMonthlyOverContributionTax(plan, over);
			const taxSoFar = pending === 0 && (summary.tax_this_year ?? 0) > 0 ? summary.tax_this_year! : 0;
			const soFar = taxSoFar > 0 ? ` Estimated tax so far this year: ${formatCurrency(taxSoFar)}.` : "";

			if (plan === "rrsp" && over <= RRSP_OVER_CONTRIBUTION_BUFFER) {
				notices.push({
					level: "warning",
					message: `${formatCurrency(over)} over your ${roomTerm}. This is within CRA's $2,000 buffer, so there is no tax, but the excess is not deductible.`,
				});
			} else if (isRegisteredPlan(plan)) {
				const taxed =
					plan === "rrsp"
						? ` on the ${formatCurrency(over - RRSP_OVER_CONTRIBUTION_BUFFER)} above the $2,000 buffer`
						: "";
				notices.push({
					level: "exceeded",
					message: `${formatCurrency(over)} over your ${roomTerm}. CRA charges 1% a month${taxed}, about ${formatCurrency(monthlyTax)} a month until it is withdrawn.${soFar}`,
				});
			} else {
				notices.push({
					level: "exceeded",
					message: `${formatCurrency(over)} over the contribution room you set for this account.`,
				});
			}
		} else if (available > 0 && available - roomAfter >= available * APPROACHING_THRESHOLD) {
			notices.push({
				level: "warning",
				message: `Only ${formatCurrency(roomAfter)} of ${roomTerm} left.`,
			});
		}
	}

	if (summary.annual_remaining !== null && summary.annual_limit !== null && !roomExceeded) {
		const annualAfter = summary.annual_remaining - pending;
		if (annualAfter < 0) {
			const over = formatCurrency(Math.abs(annualAfter));
			// TFSA and RRSP carry unused room forward, and FHSA participation room includes up to
			// $8,000 carried forward, so going past the yearly figure is fine while the room covers it.
			if (plan === "tfsa" || plan === "rrsp" || plan === "fhsa") {
				notices.push({
					level: "info",
					message: `${over} above this year's ${formatCurrency(summary.annual_limit)} limit. Unused room from earlier years can cover this, so check your remaining room.`,
				});
			} else {
				notices.push({
					level: "warning",
					message: `${over} above this year's ${planLabel} limit of ${formatCurrency(summary.annual_limit)}.`,
				});
			}
		}
	}

	if (summary.room_needs_update && summary.room_as_of) {
		notices.push({
			level: "info",
			message: `Your ${roomTerm} was entered for ${parseLocalDate(summary.room_as_of).getFullYear()}. Copy this year's figure from CRA My Account and update the account.`,
		});
	}

	return notices;
}
