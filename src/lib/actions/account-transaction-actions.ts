"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/define-action.server";
import { dateStringSchema, idSchema, moneySchema } from "@/lib/action-schemas";
import { deleteLedgerEntry, updateLedgerEntry, type LedgerEntryUpdate } from "@/lib/domain/transactions";

export type UpdateAccountTransactionInput = LedgerEntryUpdate;

const updateAccountTransactionSchema = z.object({
	description: z.string().optional(),
	amount: moneySchema.optional(),
	transactionDate: dateStringSchema.optional(),
	transactionType: z
		.enum(["deposit", "withdrawal", "interest", "payment", "adjustment", "contribution", "transfer", "refund", "fee"])
		.optional(),
});

function revalidateTransactionPages() {
	revalidatePath("/accounts");
	revalidatePath("/allocations");
	revalidatePath("/dashboard");
}

/** Edits one ledger row, moves the balance by the difference and keeps a linked budget row in step. */
export const updateAccountTransaction = defineAction(
	"updateAccountTransaction",
	[idSchema, updateAccountTransactionSchema],
	async (ctx, id, input) => {
		await updateLedgerEntry(ctx, id, input);
		revalidateTransactionPages();
	}
);

/** Deletes one ledger row, reverses its balance change and removes a linked budget row. */
export const deleteAccountTransaction = defineAction("deleteAccountTransaction", [idSchema], async (ctx, id) => {
	await deleteLedgerEntry(ctx, id);
	revalidateTransactionPages();
});
