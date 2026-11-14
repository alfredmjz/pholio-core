"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError } from "@/lib/action-result";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { dateStringSchema, idSchema, moneySchema } from "@/lib/action-schemas";
import { createTransaction } from "@/lib/domain/transactions";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import type { TransactionType } from "@/app/accounts/types";
import { presetStore, type TransactionPreset } from "./preset-store";

export type { CreateTransactionPresetInput, TransactionPreset } from "./preset-store";

const presetSchema = z.object({
	name: z.string().trim().min(1, "Give the preset a name."),
	description: z.string(),
	amount: moneySchema,
	type: z.enum(["income", "expense", "transfer"]),
	transaction_type: z.string(),
	category_id: idSchema.nullable(),
	account_id: idSchema.nullable(),
	to_account_id: idSchema.nullish(),
});

const presetEntriesSchema = z.array(z.object({ date: dateStringSchema, count: z.number().int() }));

/**
 * The transaction a preset records on one date. Transfers move money between the preset's two
 * accounts and skip the budget; income and expenses land in the preset's category.
 */
function presetToInput(
	preset: TransactionPreset,
	entry: { date: string; amount: number; description: string; categoryId: string | null }
): UnifiedTransactionInput {
	if (preset.type === "transfer") {
		if (!preset.account_id || !preset.to_account_id) {
			throw new ActionError(
				"invalid_input",
				"This transfer preset is missing an account. Edit it to pick both accounts."
			);
		}
		return {
			description: entry.description,
			amount: entry.amount,
			date: entry.date,
			type: "transfer",
			categoryId: null,
			accountId: null,
			fromAccountId: preset.account_id,
			toAccountId: preset.to_account_id,
			transactionType: "transfer",
			source: "transfer",
		};
	}
	return {
		description: entry.description,
		amount: entry.amount,
		date: entry.date,
		type: preset.type,
		categoryId: entry.categoryId,
		accountId: preset.account_id,
		transactionType: preset.transaction_type as TransactionType,
		source: "manual",
	};
}

export async function getTransactionPresets(): Promise<{
	success: boolean;
	data?: TransactionPreset[];
	error?: string;
}> {
	const ctx = await getReadContext();
	if (!ctx) return { success: false, error: "You must be logged in" };
	const presets = await presetStore(ctx).list();
	return presets ? { success: true, data: presets } : { success: false, error: "Failed to load presets" };
}

export const createTransactionPreset = defineAction("createTransactionPreset", [presetSchema], async (ctx, input) => {
	const preset = await presetStore(ctx).create(input);
	revalidatePath("/allocations");
	return preset;
});

export const updateTransactionPreset = defineAction(
	"updateTransactionPreset",
	[idSchema, presetSchema],
	async (ctx, id, input) => {
		const preset = await presetStore(ctx).update(id, input);
		if (!preset) throw new ActionError("not_found", "That preset no longer exists.");
		revalidatePath("/allocations");
		return preset;
	}
);

export const deleteTransactionPreset = defineAction("deleteTransactionPreset", [idSchema], async (ctx, id) => {
	await presetStore(ctx).remove(id);
	revalidatePath("/allocations");
});

/** Records a preset on each picked day; several on one day become one row with the summed amount. */
export const createTransactionsFromPresetBulk = defineAction(
	"createTransactionsFromPresetBulk",
	[idSchema, presetEntriesSchema],
	async (ctx, presetId, entries) => {
		const store = presetStore(ctx);
		const preset = await store.get(presetId);
		if (!preset) throw new ActionError("not_found", "Preset not found");

		try {
			for (const entry of entries) {
				if (entry.count <= 0) continue;

				const categoryId =
					preset.type === "transfer" ? null : await store.categoryForDate(preset.category_id, entry.date);
				const input = presetToInput(preset, {
					date: entry.date,
					amount: preset.amount * entry.count,
					description: entry.count > 1 ? `${preset.description} (x${entry.count})` : preset.description,
					categoryId,
				});

				try {
					await createTransaction(ctx, input);
				} catch (error) {
					if (!(error instanceof ActionError)) throw error;
					throw new ActionError(error.code, `Failed to insert transaction for ${entry.date}: ${error.message}`);
				}
			}
		} finally {
			// Days recorded before a failure stay recorded, so the pages refresh either way.
			revalidatePath("/allocations");
			revalidatePath("/accounts");
			revalidatePath("/dashboard");
		}
	}
);
