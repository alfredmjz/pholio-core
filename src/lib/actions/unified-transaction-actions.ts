"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { dateStringSchema, idSchema, moneySchema } from "@/lib/action-schemas";
import { Logger } from "@/lib/logger";
import { createTransaction, deleteTransaction, updateTransaction } from "@/lib/domain/transactions";
import type { AccountWithType } from "@/app/accounts/types";
import { transactionStore } from "./transaction-store";

const DEFAULT_DESCRIPTIONS = [
	"Grocery Store",
	"Rent Payment",
	"Electric Bill",
	"Water Bill",
	"Internet Subscription",
	"Restaurant Dinner",
	"Coffee Shop",
	"Gas Station",
	"Uber Ride",
	"Car Insurance",
	"Netflix Subscription",
	"Spotify",
	"Paycheck",
];

// Next.js can serialise a missing optional argument as "$undefined".
const optionalIdSchema = z
	.string()
	.nullish()
	.transform((value) => (!value || value === "$undefined" ? null : value));

const transactionTypeSchema = z.enum([
	"deposit",
	"withdrawal",
	"interest",
	"payment",
	"adjustment",
	"contribution",
	"transfer",
	"refund",
	"fee",
]);

const unifiedTransactionSchema = z.object({
	description: z.string(),
	amount: moneySchema,
	date: dateStringSchema,
	notes: z
		.string()
		.nullish()
		.transform((value) => value ?? undefined),
	type: z.enum(["income", "expense", "transfer"]),
	categoryId: optionalIdSchema,
	accountId: optionalIdSchema,
	fromAccountId: optionalIdSchema,
	toAccountId: optionalIdSchema,
	transactionType: transactionTypeSchema.optional(),
	allowOverpayment: z.boolean().optional(),
	isCashAdvance: z.boolean().optional(),
	source: z.string().optional(),
});

function revalidateTransactionPages() {
	revalidatePath("/allocations");
	revalidatePath("/accounts");
	revalidatePath("/dashboard");
}

/** Records a budget row and, when an account is tagged, its balance change. */
export const createUnifiedTransaction = defineAction(
	"createUnifiedTransaction",
	[unifiedTransactionSchema],
	async (ctx, input) => {
		const created = await createTransaction(ctx, input);
		revalidateTransactionPages();
		return created;
	}
);

export const updateUnifiedTransaction = defineAction(
	"updateUnifiedTransaction",
	[idSchema, unifiedTransactionSchema],
	async (ctx, id, input) => {
		await updateTransaction(ctx, id, input);
		revalidateTransactionPages();
	}
);

export const deleteUnifiedTransaction = defineAction("deleteUnifiedTransaction", [idSchema], async (ctx, id) => {
	await deleteTransaction(ctx, id);
	revalidateTransactionPages();
});

/** Active accounts for account pickers. */
export async function getAccountsForSelector(): Promise<AccountWithType[]> {
	const ctx = await getReadContext();
	return ctx ? transactionStore(ctx).listSelectableAccounts() : [];
}

/** Previously used descriptions for autofill, or common examples when there are none. */
export async function getTransactionDescriptions(): Promise<string[]> {
	try {
		const ctx = await getReadContext();
		const used = ctx ? await transactionStore(ctx).listUsedDescriptions() : [];
		const descriptions = used.length > 0 ? used : DEFAULT_DESCRIPTIONS;
		return [...descriptions].sort((a, b) => a.localeCompare(b));
	} catch (error) {
		Logger.error("Error fetching transaction descriptions", { error });
		return DEFAULT_DESCRIPTIONS;
	}
}
