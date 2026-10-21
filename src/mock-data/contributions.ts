import type { RegisteredPlan } from "@/app/balancesheet/types";
import type { ContributionRoomSetting, ContributionSummary } from "@/lib/types/contribution";
import { getDemoNow, toDateOnly } from "./demo-date";

const TFSA_MONTHLY_CONTRIBUTION = 500;
const TFSA_ROOM_ON_JAN_1 = 25000;
const TFSA_ANNUAL_LIMIT = 7000;

/**
 * Sample contribution pools for demo mode. The sample TFSA (acc-3) receives a fixed monthly
 * contribution in every month up to the demo date, with room anchored on 1 January of the
 * requested year so the demo always looks current.
 */
export function getSampleContributionSummaries(
	year: number,
	month: number,
	now: Date = getDemoNow()
): ContributionSummary[] {
	const nowYear = now.getFullYear();
	const nowMonth = now.getMonth() + 1;
	const isFuture = year > nowYear || (year === nowYear && month > nowMonth);
	const monthsContributed = year < nowYear ? month : year > nowYear ? 0 : Math.min(month, nowMonth);
	const monthContributions = isFuture ? 0 : TFSA_MONTHLY_CONTRIBUTION;
	const yearContributions = monthsContributed * TFSA_MONTHLY_CONTRIBUTION;

	return [
		{
			pool_key: "tfsa",
			contribution_plan: "tfsa",
			tracks_room: true,
			account_ids: ["acc-3"],
			accounts: [
				{ account_id: "acc-3", month_contributions: monthContributions, year_contributions: yearContributions },
			],
			month_contributions: monthContributions,
			month_withdrawals: 0,
			year_contributions: yearContributions,
			year_withdrawals: 0,
			lifetime_contributions: yearContributions,
			annual_limit: TFSA_ANNUAL_LIMIT,
			annual_limit_source: "cra",
			annual_remaining: TFSA_ANNUAL_LIMIT - yearContributions,
			room_as_of: toDateOnly(new Date(year, 0, 1)),
			room_entered: TFSA_ROOM_ON_JAN_1,
			room_added: 0,
			room_used: yearContributions,
			room_remaining: TFSA_ROOM_ON_JAN_1 - yearContributions,
			lifetime_limit: null,
			room_needs_update: false,
		},
	];
}

export function getSampleContributionRooms(now: Date = getDemoNow()): ContributionRoomSetting[] {
	return [
		{
			plan: "tfsa",
			room: TFSA_ROOM_ON_JAN_1,
			room_as_of: toDateOnly(new Date(now.getFullYear(), 0, 1)),
			annual_limit: null,
		},
	];
}

/** The sample "TFSA" budget category is linked to the TFSA plan. */
export function getSampleCategoryContributionPlans(): Record<string, RegisteredPlan> {
	return { "cat-tfsa": "tfsa" };
}
