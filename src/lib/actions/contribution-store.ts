import { Logger } from "@/lib/logger";
import type { DataContext, DemoContext, SupabaseContext } from "@/lib/data-context.server";
import {
	getSampleCategoryContributionPlans,
	getSampleContributionRooms,
	getSampleContributionSummaries,
} from "@/mock-data/contributions";
import type { RegisteredPlan } from "@/app/accounts/types";
import type { ContributionAccountShare, ContributionRoomSetting, ContributionSummary } from "@/lib/types/contribution";

export interface ContributionStore {
	/** Summaries for every plan pool and investment account, as at the end of the given month. */
	summaries(year: number, month: number): Promise<ContributionSummary[]>;
	/** The plan each budget category of the month is linked to, by category id. */
	categoryPlans(year: number, month: number): Promise<Record<string, RegisteredPlan>>;
	rooms(): Promise<ContributionRoomSetting[]>;
	saveRoom(setting: ContributionRoomSetting): Promise<void>;
}

export function contributionStore(ctx: DataContext): ContributionStore {
	return ctx.kind === "demo" ? demoContributionStore(ctx) : supabaseContributionStore(ctx);
}

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

function supabaseContributionStore({ db, userId }: SupabaseContext): ContributionStore {
	return {
		async summaries(year, month) {
			const { data, error } = await db.rpc("get_contribution_summaries", { p_year: year, p_month: month });
			if (error) {
				Logger.error("Error fetching contribution summaries", { error });
				return [];
			}
			return ((data as Record<string, unknown>[]) || []).map(normalizeSummary);
		},

		async categoryPlans(year, month) {
			const { data: allocation } = await db
				.from("allocations")
				.select("id")
				.eq("user_id", userId)
				.eq("year", year)
				.eq("month", month)
				.maybeSingle();

			const categoryPlans: Record<string, RegisteredPlan> = {};
			if (!allocation) return categoryPlans;

			const { data: categories, error } = await db
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
			return categoryPlans;
		},

		async rooms() {
			const { data, error } = await db
				.from("contribution_rooms")
				.select("plan, room, room_as_of, annual_limit")
				.eq("user_id", userId);
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
		},

		async saveRoom(setting) {
			const { error } = await db.from("contribution_rooms").upsert(
				{
					user_id: userId,
					plan: setting.plan,
					room: setting.room,
					room_as_of: setting.room_as_of,
					annual_limit: setting.annual_limit,
				},
				{ onConflict: "user_id,plan" }
			);
			if (error) throw error;
		},
	};
}

function demoContributionStore(_ctx: DemoContext): ContributionStore {
	return {
		async summaries(year, month) {
			return getSampleContributionSummaries(year, month);
		},
		async categoryPlans() {
			return getSampleCategoryContributionPlans();
		},
		async rooms() {
			return getSampleContributionRooms();
		},
		async saveRoom() {},
	};
}
