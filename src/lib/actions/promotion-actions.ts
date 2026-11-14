"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError } from "@/lib/action-result";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { dateStringSchema, idSchema, nonNegativeMoneySchema } from "@/lib/action-schemas";
import { getTodayDateString } from "@/lib/date-utils";
import type { AccountPromotion } from "@/app/accounts/types";
import type { HeadsUpPromotion } from "@/app/dashboard/heads-up";
import { promotionStore } from "./promotion-store";

const promotionTypeSchema = z.enum(["spend_threshold", "deposit_threshold", "maintaining_balance"]);

const createPromotionSchema = z.object({
	account_id: idSchema,
	title: z.string().trim().min(1, "Give the promotion a title."),
	promotion_type: promotionTypeSchema,
	target_amount: nonNegativeMoneySchema,
	reward_description: z.string().trim().min(1, "Describe the reward."),
	start_date: dateStringSchema.optional(),
	end_date: dateStringSchema,
	notes: z.string().nullish(),
});

const updatePromotionSchema = z.object({
	title: z.string().trim().min(1, "Give the promotion a title.").optional(),
	promotion_type: promotionTypeSchema.optional(),
	target_amount: nonNegativeMoneySchema.optional(),
	current_amount: nonNegativeMoneySchema.optional(),
	reward_description: z.string().trim().min(1, "Describe the reward.").optional(),
	start_date: dateStringSchema.optional(),
	end_date: dateStringSchema.optional(),
	is_completed: z.boolean().optional(),
	notes: z.string().nullish(),
});

/** Open promotions across all accounts, in the shape the Dashboard and Accounts heads-up lists use. */
export async function getOpenPromotions(today: string): Promise<HeadsUpPromotion[]> {
	const ctx = await getReadContext();
	return ctx ? promotionStore(ctx).listOpen(today) : [];
}

export async function getAccountPromotions(accountId: string): Promise<AccountPromotion[]> {
	const ctx = await getReadContext();
	return ctx ? promotionStore(ctx).listForAccount(accountId) : [];
}

export const createAccountPromotion = defineAction(
	"createAccountPromotion",
	[createPromotionSchema],
	async (ctx, input) => {
		const store = promotionStore(ctx);
		const promotion = await store.create({ ...input, start_date: input.start_date ?? getTodayDateString() });
		await store.recalculate(input.account_id);
		revalidatePath("/accounts");
		return promotion;
	}
);

/** Recalculates progress too, since dates, target or type may have changed. */
export const updateAccountPromotion = defineAction(
	"updateAccountPromotion",
	[idSchema, updatePromotionSchema],
	async (ctx, id, input) => {
		const store = promotionStore(ctx);
		const accountId = await store.update(id, input);
		if (!accountId) throw new ActionError("not_found", "That promotion no longer exists.");
		await store.recalculate(accountId);
		revalidatePath("/accounts");
	}
);

export const deleteAccountPromotion = defineAction("deleteAccountPromotion", [idSchema], async (ctx, id) => {
	await promotionStore(ctx).remove(id);
	revalidatePath("/accounts");
});

/** Manual refresh of progress; definition changes already recalculate. */
export const refreshAccountPromotions = defineAction("refreshAccountPromotions", [idSchema], async (ctx, accountId) => {
	await promotionStore(ctx).recalculate(accountId);
	revalidatePath("/accounts");
});
