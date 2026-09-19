"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Logger } from "@/lib/logger";
import type { AccountPromotion, CreatePromotionInput, UpdatePromotionInput } from "@/app/balancesheet/types";
import { getTodayDateString } from "@/lib/date-utils";

// Mock data memory store when sample data mode is active
let samplePromotionsStore: Record<string, AccountPromotion[]> = {
	"acc-4": [
		{
			id: "promo-sample-1",
			account_id: "acc-4",
			user_id: "sample-user",
			title: "Spend $4,000 in 90 Days for 60k Points",
			promotion_type: "spend_threshold",
			target_amount: 4000,
			current_amount: 2850,
			reward_description: "60,000 Aeroplan Points",
			start_date: "2026-07-15",
			end_date: "2026-10-15",
			is_completed: false,
			notes: "Minimum spend requirement for sign-up bonus",
			created_at: "2026-07-15T10:00:00Z",
			updated_at: "2026-07-15T10:00:00Z",
		},
	],
};

/**
 * Fetch promotions for a specific account
 */
export async function getAccountPromotions(accountId: string): Promise<AccountPromotion[]> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return samplePromotionsStore[accountId] || [];
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return [];

		const { data, error } = await supabase
			.from("account_promotions")
			.select("*")
			.eq("account_id", accountId)
			.eq("user_id", user.id)
			.order("end_date", { ascending: true });

		if (error) {
			Logger.error("Error fetching account promotions", { error, accountId });
			return [];
		}

		return data || [];
	} catch (error) {
		Logger.error("Error in getAccountPromotions", { error });
		return [];
	}
}

/**
 * Create a new promotion for an account
 */
export async function createAccountPromotion(input: CreatePromotionInput): Promise<AccountPromotion | null> {
	const startDate = input.start_date || getTodayDateString();

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		const newPromo: AccountPromotion = {
			id: `promo-${Date.now()}`,
			account_id: input.account_id,
			user_id: "sample-user",
			title: input.title,
			promotion_type: input.promotion_type,
			target_amount: input.target_amount,
			current_amount: 0,
			reward_description: input.reward_description,
			start_date: startDate,
			end_date: input.end_date,
			is_completed: false,
			notes: input.notes || null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		if (!samplePromotionsStore[input.account_id]) {
			samplePromotionsStore[input.account_id] = [];
		}
		samplePromotionsStore[input.account_id].push(newPromo);
		revalidatePath("/balancesheet");
		return newPromo;
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) throw new Error("Unauthorized");

		const { data, error } = await supabase
			.from("account_promotions")
			.insert({
				user_id: user.id,
				account_id: input.account_id,
				title: input.title,
				promotion_type: input.promotion_type,
				target_amount: input.target_amount,
				current_amount: 0,
				reward_description: input.reward_description,
				start_date: startDate,
				end_date: input.end_date,
				notes: input.notes || null,
			})
			.select()
			.single();

		if (error) {
			Logger.error("Error creating promotion", { error });
			return null;
		}

		await refreshAccountPromotions(input.account_id);
		revalidatePath("/balancesheet");
		return data;
	} catch (error) {
		Logger.error("Error in createAccountPromotion", { error });
		return null;
	}
}

/**
 * Update an existing promotion
 */
export async function updateAccountPromotion(id: string, input: UpdatePromotionInput): Promise<boolean> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		Object.keys(samplePromotionsStore).forEach((accId) => {
			samplePromotionsStore[accId] = samplePromotionsStore[accId].map((p) => {
				if (p.id === id) {
					return { ...p, ...input, updated_at: new Date().toISOString() };
				}
				return p;
			});
		});
		revalidatePath("/balancesheet");
		return true;
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return false;

		const { error } = await supabase.from("account_promotions").update(input).eq("id", id).eq("user_id", user.id);

		if (error) {
			Logger.error("Error updating promotion", { error, id });
			return false;
		}

		revalidatePath("/balancesheet");
		return true;
	} catch (error) {
		Logger.error("Error in updateAccountPromotion", { error });
		return false;
	}
}

/**
 * Delete a promotion
 */
export async function deleteAccountPromotion(id: string): Promise<boolean> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		Object.keys(samplePromotionsStore).forEach((accId) => {
			samplePromotionsStore[accId] = samplePromotionsStore[accId].filter((p) => p.id !== id);
		});
		revalidatePath("/balancesheet");
		return true;
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return false;

		const { error } = await supabase.from("account_promotions").delete().eq("id", id).eq("user_id", user.id);

		if (error) {
			Logger.error("Error deleting promotion", { error, id });
			return false;
		}

		revalidatePath("/balancesheet");
		return true;
	} catch (error) {
		Logger.error("Error in deleteAccountPromotion", { error });
		return false;
	}
}

/**
 * Ask PostgreSQL to recompute progress for this account open promotions.
 *
 * The authoritative calculation lives in `public.recalculate_account_promotions` and is
 * also fired by a trigger on `account_transactions`, so this action is only required
 * after a promotion definition changes (dates, target or type).
 */
export async function refreshAccountPromotions(accountId: string): Promise<void> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") return;

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return;

		const { error } = await supabase.rpc("recalculate_account_promotions", { p_account_id: accountId });

		if (error) {
			Logger.error("Error refreshing promotion progress", { error, accountId });
			return;
		}

		revalidatePath("/balancesheet");
	} catch (error) {
		Logger.error("Error in refreshAccountPromotions", { error });
	}
}
