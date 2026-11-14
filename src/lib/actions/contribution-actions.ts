"use server";

/**
 * Investment contribution tracking (issue #121).
 *
 * Monthly deposits, annual progress and remaining contribution room are derived per plan in
 * PostgreSQL by `get_contribution_summaries()` (migration 013) so the figures always match
 * the ledger. These actions fetch them and save the room settings copied from CRA.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError } from "@/lib/action-result";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { moneySchema, nonNegativeMoneySchema } from "@/lib/action-schemas";
import { Logger } from "@/lib/logger";
import type {
	AccountContribution,
	AllocationContributions,
	ContributionRoomSetting,
	ContributionSummary,
} from "@/lib/types/contribution";
import { contributionStore } from "./contribution-store";

const roomSettingSchema = z.object({
	plan: z.enum(["tfsa", "rrsp", "fhsa", "resp"]),
	room: moneySchema.nullable(),
	room_as_of: z.string().nullable(),
	annual_limit: nonNegativeMoneySchema.nullable(),
});

/**
 * Contribution summaries for every plan pool and investment account, as at the end of the
 * given month.
 */
export async function getContributionSummaries(year: number, month: number): Promise<ContributionSummary[]> {
	const ctx = await getReadContext();
	return ctx ? contributionStore(ctx).summaries(year, month) : [];
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
	const ctx = await getReadContext();
	if (!ctx) return { pools: [], categoryPlans: {} };

	const store = contributionStore(ctx);
	const [pools, categoryPlans] = await Promise.all([store.summaries(year, month), store.categoryPlans(year, month)]);
	return { pools, categoryPlans };
}

/** Room settings the user copied from CRA, one per registered plan. */
export async function getContributionRooms(): Promise<ContributionRoomSetting[]> {
	const ctx = await getReadContext();
	return ctx ? contributionStore(ctx).rooms() : [];
}

/** Saves the room for a registered plan; every account of that plan shares it. */
export const saveContributionRoom = defineAction("saveContributionRoom", [roomSettingSchema], async (ctx, setting) => {
	try {
		await contributionStore(ctx).saveRoom(setting);
	} catch (error) {
		Logger.error("Error saving contribution room", { error, plan: setting.plan });
		throw new ActionError("failed", "Couldn't save your contribution room. Try again.");
	}
	revalidatePath("/accounts");
	revalidatePath("/allocations");
});
