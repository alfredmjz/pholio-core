"use server";

import { revalidatePath } from "next/cache";
import { chargeDay } from "@/app/accounts/account-charge-form";
import type { AccountCharge, AccountChargeInput } from "@/app/accounts/types";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { Logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getSampleAccountCharges } from "@/mock-data/accounts";

// Sample data mode keeps edits in memory for the life of the server process.
let sampleChargesStore: Record<string, AccountCharge[]> | null = null;
const sampleCharges = () => (sampleChargesStore ??= getSampleAccountCharges());

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

/** The charges listed on an account that are still in use. */
export async function getAccountCharges(accountId: string): Promise<AccountCharge[]> {
	if (await isSampleDataMode()) {
		return sampleCharges()[accountId] ?? [];
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return [];

		const { data, error } = await supabase
			.from("account_charges")
			.select(COLUMNS)
			.eq("account_id", accountId)
			.eq("user_id", user.id)
			.eq("is_active", true)
			.order("created_at", { ascending: true });

		if (error) {
			Logger.error("Error fetching account charges", { error, accountId });
			return [];
		}
		return (data ?? []).map(toCharge);
	} catch (error) {
		Logger.error("Error in getAccountCharges", { error });
		return [];
	}
}

export async function createAccountCharge(accountId: string, input: AccountChargeInput): Promise<boolean> {
	if (await isSampleDataMode()) {
		const now = new Date().toISOString();
		const store = sampleCharges();
		store[accountId] = [
			...(store[accountId] ?? []),
			{
				id: `charge-${Date.now()}`,
				account_id: accountId,
				user_id: "sample-user",
				...toRow(input),
				is_active: true,
				created_at: now,
				updated_at: now,
			},
		];
		revalidatePath(`/accounts/${accountId}`);
		return true;
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return false;

		const { error } = await supabase
			.from("account_charges")
			.insert({ ...toRow(input), account_id: accountId, user_id: user.id });

		if (error) {
			Logger.error("Error creating account charge", { error, accountId });
			return false;
		}
		revalidatePath(`/accounts/${accountId}`);
		return true;
	} catch (error) {
		Logger.error("Error in createAccountCharge", { error });
		return false;
	}
}

export async function updateAccountCharge(id: string, accountId: string, input: AccountChargeInput): Promise<boolean> {
	if (await isSampleDataMode()) {
		const store = sampleCharges();
		store[accountId] = (store[accountId] ?? []).map((charge) =>
			charge.id === id ? { ...charge, ...toRow(input), updated_at: new Date().toISOString() } : charge
		);
		revalidatePath(`/accounts/${accountId}`);
		return true;
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return false;

		const { error } = await supabase.from("account_charges").update(toRow(input)).eq("id", id).eq("user_id", user.id);

		if (error) {
			Logger.error("Error updating account charge", { error, id });
			return false;
		}
		revalidatePath(`/accounts/${accountId}`);
		return true;
	} catch (error) {
		Logger.error("Error in updateAccountCharge", { error });
		return false;
	}
}

/** Stops a charge. Fees it already posted stay on the account, so the row is retired, not deleted. */
export async function removeAccountCharge(id: string, accountId: string): Promise<boolean> {
	if (await isSampleDataMode()) {
		const store = sampleCharges();
		store[accountId] = (store[accountId] ?? []).filter((charge) => charge.id !== id);
		revalidatePath(`/accounts/${accountId}`);
		return true;
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return false;

		const { error } = await supabase
			.from("account_charges")
			.update({ is_active: false })
			.eq("id", id)
			.eq("user_id", user.id);

		if (error) {
			Logger.error("Error removing account charge", { error, id });
			return false;
		}
		revalidatePath(`/accounts/${accountId}`);
		return true;
	} catch (error) {
		Logger.error("Error in removeAccountCharge", { error });
		return false;
	}
}
