import { Logger } from "@/lib/logger";
import { demoSlice, type DataContext, type DemoContext, type SupabaseContext } from "@/lib/data-context.server";
import { chargeDay } from "@/app/accounts/account-charge-form";
import type { AccountCharge, AccountChargeInput } from "@/app/accounts/types";
import { getSampleAccountCharges } from "@/mock-data/accounts";

export interface AccountChargeStore {
	/** The charges listed on an account that are still in use. */
	list(accountId: string): Promise<AccountCharge[]>;
	create(accountId: string, input: AccountChargeInput): Promise<void>;
	/** Returns false when no such charge exists. */
	update(id: string, accountId: string, input: AccountChargeInput): Promise<boolean>;
	/** Retires the charge. Returns false when no such charge exists. */
	remove(id: string, accountId: string): Promise<boolean>;
}

export function accountChargeStore(ctx: DataContext): AccountChargeStore {
	return ctx.kind === "demo" ? demoAccountChargeStore(ctx) : supabaseAccountChargeStore(ctx);
}

const COLUMNS =
	"id, account_id, user_id, name, frequency, amount, rate, charge_day, next_charge_date, waive_min_balance, is_active, created_at, updated_at";

function toRow(input: AccountChargeInput) {
	return {
		name: input.name,
		frequency: input.frequency,
		amount: input.amount,
		rate: input.rate,
		next_charge_date: input.next_charge_date,
		charge_day: input.next_charge_date ? chargeDay(input.next_charge_date) : null,
		waive_min_balance: input.waive_min_balance,
	};
}

const toCharge = (row: any): AccountCharge => ({
	...row,
	amount: row.amount == null ? null : Number(row.amount),
	rate: row.rate == null ? null : Number(row.rate),
	waive_min_balance: row.waive_min_balance == null ? null : Number(row.waive_min_balance),
});

function supabaseAccountChargeStore({ db, userId }: SupabaseContext): AccountChargeStore {
	return {
		async list(accountId) {
			const { data, error } = await db
				.from("account_charges")
				.select(COLUMNS)
				.eq("account_id", accountId)
				.eq("user_id", userId)
				.eq("is_active", true)
				.order("created_at", { ascending: true });
			if (error) {
				Logger.error("Error fetching account charges", { error, accountId });
				return [];
			}
			return (data ?? []).map(toCharge);
		},

		async create(accountId, input) {
			const { error } = await db
				.from("account_charges")
				.insert({ ...toRow(input), account_id: accountId, user_id: userId });
			if (error) throw error;
		},

		async update(id, _accountId, input) {
			const { data, error } = await db
				.from("account_charges")
				.update(toRow(input))
				.eq("id", id)
				.eq("user_id", userId)
				.select("id");
			if (error) throw error;
			return Boolean(data && data.length > 0);
		},

		async remove(id) {
			const { data, error } = await db
				.from("account_charges")
				.update({ is_active: false })
				.eq("id", id)
				.eq("user_id", userId)
				.select("id");
			if (error) throw error;
			return Boolean(data && data.length > 0);
		},
	};
}

function demoAccountChargeStore(ctx: DemoContext): AccountChargeStore {
	const byAccount = demoSlice(ctx, "accountCharges", () => getSampleAccountCharges());

	return {
		async list(accountId) {
			return byAccount[accountId] ?? [];
		},

		async create(accountId, input) {
			const now = new Date().toISOString();
			byAccount[accountId] = [
				...(byAccount[accountId] ?? []),
				{
					id: `charge-${Date.now()}`,
					account_id: accountId,
					user_id: ctx.userId,
					...toRow(input),
					is_active: true,
					created_at: now,
					updated_at: now,
				},
			];
		},

		async update(id, accountId, input) {
			const charges = byAccount[accountId] ?? [];
			if (!charges.some((charge) => charge.id === id)) return false;
			byAccount[accountId] = charges.map((charge) =>
				charge.id === id ? { ...charge, ...toRow(input), updated_at: new Date().toISOString() } : charge
			);
			return true;
		},

		async remove(id, accountId) {
			const charges = byAccount[accountId] ?? [];
			byAccount[accountId] = charges.filter((charge) => charge.id !== id);
			return charges.some((charge) => charge.id === id);
		},
	};
}
