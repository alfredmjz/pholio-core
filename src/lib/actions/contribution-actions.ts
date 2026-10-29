"use server";

/**
 * Investment contribution tracking (issue #121).
 *
 * Monthly deposits, annual progress and remaining contribution room are derived per plan in
 * PostgreSQL by `get_contribution_summaries()` (migration 013) so the figures always match
 * the ledger. These actions fetch them and save the room settings copied from CRA.
 */

import { revalidatePath } from "next/cache";
import { createClient, getReadUserId } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import {
	getSampleCategoryContributionPlans,
	getSampleContributionRooms,
	getSampleContributionSummaries,
} from "@/mock-data/contributions";
import type { RegisteredPlan } from "@/app/accounts/types";
import type {
	AccountContribution,
	AllocationContributions,
	ContributionAccountShare,
	ContributionRoomSetting,
	ContributionSummary,
} from "@/lib/types/contribution";

const NUMERIC_FIELDS = [
	"month_contributions",
	"month_withdrawals",
	"year_contributions",
	"year_withdrawals",
	"lifetime_contributions",
	"annual_limit",
	"annual_remaining",
	"room_entered",
	"room_added",
	"room_used",
	"room_remaining",
	"lifetime_limit",
	"excess_amount",
	"tax_this_month",
	"tax_this_year",
	"tax_total",
	"taxed_months",
] as const;

const toNumberOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** PostgREST may serialise DECIMAL as a string; normalise every amount to a number. */
function normalizeSummary(row: Record<string, unknown>): ContributionSummary {
	const summary = { ...row } as Record<string, unknown>;
	for (const field of NUMERIC_FIELDS) {
		summary[field] = toNumberOrNull(summary[field]);
	}
	summary.account_ids = (row.account_ids as string[] | null) ?? [];
	summary.accounts = ((row.accounts as Record<string, unknown>[] | null) ?? []).map(
		(share): ContributionAccountShare => ({
			account_id: String(share.account_id),
			month_contributions: Number(share.month_contributions ?? 0),
			year_contributions: Number(share.year_contributions ?? 0),
		})
	);
	return summary as unknown as ContributionSummary;
}

/**
 * Contribution summaries for every plan pool and investment account, as at the end of the
 * given month.
 */
export async function getContributionSummaries(year: number, month: number): Promise<ContributionSummary[]> {
	if (await isSampleDataMode()) {
		return getSampleContributionSummaries(year, month);
	}

	const supabase = await createClient();
	if (!(await getReadUserId(supabase))) return [];

	const { data, error } = await supabase.rpc("get_contribution_summaries", { p_year: year, p_month: month });

	if (error) {
		Logger.error("Error fetching contribution summaries", { error });
		return [];
	}

	return ((data as Record<string, unknown>[]) || []).map(normalizeSummary);
}

/**
 * The pool an account belongs to (its whole plan for registered accounts) and the account's
 * own share, for the given month (defaults to the current month).
 */
export async function getAccountContributionSummary(
	accountId: string,
	year?: number,
	month?: number
): Promise<AccountContribution | null> {
	const now = new Date();
	const pools = await getContributionSummaries(year ?? now.getFullYear(), month ?? now.getMonth() + 1);
	const pool = pools.find((p) => p.account_ids.includes(accountId));
	if (!pool) return null;
	return { pool, share: pool.accounts.find((share) => share.account_id === accountId) ?? null };
}

/**
 * Pools plus the plan each budget category of the month is linked to (Allocations page).
 */
export async function getAllocationContributions(year: number, month: number): Promise<AllocationContributions> {
	if (await isSampleDataMode()) {
		return {
			pools: getSampleContributionSummaries(year, month),
			categoryPlans: getSampleCategoryContributionPlans(),
		};
	}

	const supabase = await createClient();
	const userId = await getReadUserId(supabase);

	if (!userId) return { pools: [], categoryPlans: {} };

	const [pools, { data: allocation }] = await Promise.all([
		getContributionSummaries(year, month),
		supabase.from("allocations").select("id").eq("user_id", userId).eq("year", year).eq("month", month).maybeSingle(),
	]);

	const categoryPlans: Record<string, RegisteredPlan> = {};
	if (allocation) {
		const { data: categories, error } = await supabase
			.from("allocation_categories")
			.select("id, contribution_plan")
			.eq("allocation_id", allocation.id)
			.not("contribution_plan", "is", null);

		if (error) {
			Logger.error("Error fetching category contribution plans", { error });
		}
		for (const category of categories ?? []) {
			categoryPlans[category.id] = category.contribution_plan as RegisteredPlan;
		}
	}

	return { pools, categoryPlans };
}

/** Room settings the user copied from CRA, one per registered plan. */
export async function getContributionRooms(): Promise<ContributionRoomSetting[]> {
	if (await isSampleDataMode()) {
		return getSampleContributionRooms();
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return [];

	const { data, error } = await supabase
		.from("contribution_rooms")
		.select("plan, room, room_as_of, annual_limit")
		.eq("user_id", user.id);

	if (error) {
		Logger.error("Error fetching contribution rooms", { error });
		return [];
	}

	return (data ?? []).map((row) => ({
		plan: row.plan as RegisteredPlan,
		room: toNumberOrNull(row.room),
		room_as_of: row.room_as_of,
		annual_limit: toNumberOrNull(row.annual_limit),
	}));
}

/** Saves the room for a registered plan; every account of that plan shares it. */
export async function saveContributionRoom(setting: ContributionRoomSetting): Promise<boolean> {
	if (await isSampleDataMode()) {
		return true;
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return false;

	const { error } = await supabase.from("contribution_rooms").upsert(
		{
			user_id: user.id,
			plan: setting.plan,
			room: setting.room,
			room_as_of: setting.room_as_of,
			annual_limit: setting.annual_limit,
		},
		{ onConflict: "user_id,plan" }
	);

	if (error) {
		Logger.error("Error saving contribution room", { error, plan: setting.plan });
		return false;
	}

	revalidatePath("/accounts");
	revalidatePath("/allocations");
	return true;
}
