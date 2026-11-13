"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError } from "@/lib/action-result";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { dateStringSchema, idSchema, nonNegativeMoneySchema } from "@/lib/action-schemas";
import { Logger } from "@/lib/logger";
import type { AccountCharge } from "@/app/accounts/types";
import { accountChargeStore } from "./account-charge-store";

const chargeInputSchema = z.object({
	name: z.string().trim().min(1, "Give the charge a name."),
	frequency: z.enum(["monthly", "yearly", "cash_advance"]),
	amount: nonNegativeMoneySchema.nullable(),
	rate: nonNegativeMoneySchema.nullable(),
	next_charge_date: dateStringSchema.nullable(),
	waive_min_balance: nonNegativeMoneySchema.nullable(),
});

const CHARGE_NOT_FOUND = "That charge no longer exists.";

/** The charges listed on an account that are still in use. */
export async function getAccountCharges(accountId: string): Promise<AccountCharge[]> {
	try {
		const ctx = await getReadContext();
		return ctx ? await accountChargeStore(ctx).list(accountId) : [];
	} catch (error) {
		Logger.error("Error in getAccountCharges", { error });
		return [];
	}
}

export const createAccountCharge = defineAction(
	"createAccountCharge",
	[idSchema, chargeInputSchema],
	async (ctx, accountId, input) => {
		try {
			await accountChargeStore(ctx).create(accountId, input);
		} catch (error) {
			Logger.error("Error creating account charge", { error, accountId });
			throw new ActionError("failed", "Couldn't save the charge. Please try again.");
		}
		revalidatePath(`/accounts/${accountId}`);
	}
);

export const updateAccountCharge = defineAction(
	"updateAccountCharge",
	[idSchema, idSchema, chargeInputSchema],
	async (ctx, id, accountId, input) => {
		let found: boolean;
		try {
			found = await accountChargeStore(ctx).update(id, accountId, input);
		} catch (error) {
			Logger.error("Error updating account charge", { error, id });
			throw new ActionError("failed", "Couldn't save the charge. Please try again.");
		}
		if (!found) throw new ActionError("not_found", CHARGE_NOT_FOUND);
		revalidatePath(`/accounts/${accountId}`);
	}
);

/** Stops a charge. Fees it already posted stay on the account, so the row is retired, not deleted. */
export const removeAccountCharge = defineAction(
	"removeAccountCharge",
	[idSchema, idSchema],
	async (ctx, id, accountId) => {
		let found: boolean;
		try {
			found = await accountChargeStore(ctx).remove(id, accountId);
		} catch (error) {
			Logger.error("Error removing account charge", { error, id });
			throw new ActionError("failed", "Couldn't remove the charge. Please try again.");
		}
		if (!found) throw new ActionError("not_found", CHARGE_NOT_FOUND);
		revalidatePath(`/accounts/${accountId}`);
	}
);
