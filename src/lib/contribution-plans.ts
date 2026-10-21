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

export function getContributionPlanLabel(plan: ContributionPlan | null | undefined): string {
	return CONTRIBUTION_PLAN_OPTIONS.find((option) => option.value === plan)?.label ?? "Investment";
}

export type ContributionNoticeLevel = "exceeded" | "warning" | "info";

export interface ContributionNotice {
	level: ContributionNoticeLevel;
	message: string;
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
	const pending = Math.max(0, pendingAmount);

	let roomExceeded = false;
	if (summary.room_remaining !== null) {
		const roomAfter = summary.room_remaining - pending;
		const available = (summary.room_entered ?? 0) + (summary.room_added ?? 0);

		if (roomAfter < 0) {
			roomExceeded = true;
			const over = Math.abs(roomAfter);
			if (plan === "rrsp" && over <= RRSP_OVER_CONTRIBUTION_BUFFER) {
				notices.push({
					level: "warning",
					message: `${formatCurrency(over)} over your RRSP room. This is within CRA's $2,000 buffer, so there is no penalty, but the excess is not deductible.`,
				});
			} else {
				const taxable = plan === "rrsp" ? over - RRSP_OVER_CONTRIBUTION_BUFFER : over;
				notices.push({
					level: "exceeded",
					message: `${formatCurrency(over)} over your ${planLabel} contribution room. CRA charges 1% per month on ${formatCurrency(taxable)} until it is withdrawn.`,
				});
			}
		} else if (available > 0 && available - roomAfter >= available * APPROACHING_THRESHOLD) {
			notices.push({
				level: "warning",
				message: `Only ${formatCurrency(roomAfter)} of ${planLabel} contribution room left.`,
			});
		}
	}

	if (summary.annual_remaining !== null && summary.annual_limit !== null) {
		const annualAfter = summary.annual_remaining - pending;
		if (annualAfter < 0) {
			const over = formatCurrency(Math.abs(annualAfter));
			if ((plan === "tfsa" || plan === "rrsp") && !roomExceeded) {
				notices.push({
					level: "info",
					message: `${over} above this year's ${formatCurrency(summary.annual_limit)} limit. Unused room from earlier years can cover this, so check your remaining room.`,
				});
			} else if (!roomExceeded) {
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
			message: `Your ${planLabel} room was entered for ${parseLocalDate(summary.room_as_of).getFullYear()}. Copy this year's figure from CRA My Account and update the account.`,
		});
	}

	return notices;
}
