import { Logger } from "@/lib/logger";
import { demoSlice, type DataContext, type DemoContext, type SupabaseContext } from "@/lib/data-context.server";
import { samplePromotions } from "@/mock-data/dashboard";
import type { AccountPromotion, CreatePromotionInput, UpdatePromotionInput } from "@/app/accounts/types";
import type { HeadsUpPromotion } from "@/app/dashboard/heads-up";

export type NewPromotion = CreatePromotionInput & { start_date: string };

export interface PromotionStore {
	/** Open promotions (not completed, not yet ended) across all accounts. */
	listOpen(today: string): Promise<HeadsUpPromotion[]>;
	listForAccount(accountId: string): Promise<AccountPromotion[]>;
	create(input: NewPromotion): Promise<AccountPromotion>;
	/** Returns the promotion's account id, or null when no such promotion exists. */
	update(id: string, input: UpdatePromotionInput): Promise<string | null>;
	remove(id: string): Promise<void>;
	/** Recompute progress; the calculation lives in recalculate_account_promotions(). */
	recalculate(accountId: string): Promise<void>;
}

export function promotionStore(ctx: DataContext): PromotionStore {
	return ctx.kind === "demo" ? demoPromotionStore(ctx) : supabasePromotionStore(ctx);
}

function supabasePromotionStore({ db, userId }: SupabaseContext): PromotionStore {
	return {
		async listOpen(today) {
			const { data, error } = await db
				.from("account_promotions")
				.select(
					"id, account_id, promotion_type, target_amount, current_amount, reward_description, end_date, is_completed, account:accounts(name)"
				)
				.eq("user_id", userId)
				.eq("is_completed", false)
				.gte("end_date", today);
			if (error) {
				Logger.error("Error fetching open promotions", { error });
				return [];
			}
			return (data ?? []).map((p: any) => ({
				id: p.id,
				accountId: p.account_id,
				accountName: p.account?.name ?? "this account",
				type: p.promotion_type,
				target: Number(p.target_amount),
				current: Number(p.current_amount),
				reward: p.reward_description,
				endDate: String(p.end_date).slice(0, 10),
				isCompleted: Boolean(p.is_completed),
			}));
		},

		async listForAccount(accountId) {
			const { data, error } = await db
				.from("account_promotions")
				.select("*")
				.eq("account_id", accountId)
				.eq("user_id", userId)
				.order("end_date", { ascending: true });
			if (error) {
				Logger.error("Error fetching account promotions", { error, accountId });
				return [];
			}
			return data ?? [];
		},

		async create(input) {
			const { data, error } = await db
				.from("account_promotions")
				.insert({
					user_id: userId,
					account_id: input.account_id,
					title: input.title,
					promotion_type: input.promotion_type,
					target_amount: input.target_amount,
					current_amount: 0,
					reward_description: input.reward_description,
					start_date: input.start_date,
					end_date: input.end_date,
					notes: input.notes || null,
				})
				.select()
				.single();
			if (error) throw error;
			return data;
		},

		async update(id, input) {
			const { data, error } = await db
				.from("account_promotions")
				.update(input)
				.eq("id", id)
				.eq("user_id", userId)
				.select("account_id")
				.maybeSingle();
			if (error) throw error;
			return data?.account_id ?? null;
		},

		async remove(id) {
			const { error } = await db.from("account_promotions").delete().eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async recalculate(accountId) {
			const { error } = await db.rpc("recalculate_account_promotions", { p_account_id: accountId });
			if (error) throw error;
		},
	};
}

function seedDemoPromotions(): Record<string, AccountPromotion[]> {
	return {
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
}

function demoPromotionStore(ctx: DemoContext): PromotionStore {
	const byAccount = demoSlice(ctx, "promotions", seedDemoPromotions);
	const all = () => Object.values(byAccount).flat();

	return {
		async listOpen() {
			return samplePromotions();
		},

		async listForAccount(accountId) {
			return byAccount[accountId] ?? [];
		},

		async create(input) {
			const now = new Date().toISOString();
			const promotion: AccountPromotion = {
				id: `promo-${Date.now()}`,
				account_id: input.account_id,
				user_id: ctx.userId,
				title: input.title,
				promotion_type: input.promotion_type,
				target_amount: input.target_amount,
				current_amount: 0,
				reward_description: input.reward_description,
				start_date: input.start_date,
				end_date: input.end_date,
				is_completed: false,
				notes: input.notes || null,
				created_at: now,
				updated_at: now,
			};
			(byAccount[input.account_id] ??= []).push(promotion);
			return promotion;
		},

		async update(id, input) {
			const promotion = all().find((p) => p.id === id);
			if (!promotion) return null;
			Object.assign(promotion, input, { updated_at: new Date().toISOString() });
			return promotion.account_id;
		},

		async remove(id) {
			for (const accountId of Object.keys(byAccount)) {
				byAccount[accountId] = byAccount[accountId].filter((p) => p.id !== id);
			}
		},

		async recalculate() {},
	};
}
