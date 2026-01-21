"use server";

/**
 * Account Transaction Actions
 *
 * Server actions for updating and deleting account transactions.
 * These handle balance recalculation and linked allocation transaction updates.
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Logger } from "@/lib/logger";
import type { AccountTransaction, TransactionType } from "@/app/balancesheet/types";

export interface UpdateAccountTransactionInput {
	description?: string;
	amount?: number;
	transactionDate?: string;
	transactionType?: TransactionType;
}

/**
 * Update an account transaction
 * - Updates the transaction record
 * - Recalculates account balance (reverts old, applies new)
 * - If linked to allocation transaction, updates that too
 */
export async function updateAccountTransaction(
	transactionId: string,
	input: UpdateAccountTransactionInput
): Promise<boolean> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return false;

		// 1. Get existing transaction
		const { data: existingTx, error: fetchError } = await supabase
			.from("account_transactions")
			.select("*")
			.eq("id", transactionId)
			.eq("user_id", user.id)
			.single();

		if (fetchError || !existingTx) {
			Logger.error("Account transaction not found", { error: fetchError, transactionId });
			return false;
		}

		// 2. Get account to determine balance update logic
		const { data: account } = await supabase
			.from("accounts")
			.select("*, account_type:account_types(*)")
			.eq("id", existingTx.account_id)
			.single();

		if (!account) {
			Logger.error("Account not found for transaction", { accountId: existingTx.account_id });
			return false;
		}

		// 3. Calculate new amount based on transaction type and input
		const newAmount =
			input.amount !== undefined
				? calculateAccountAmount(
						input.amount,
						input.transactionType || existingTx.transaction_type,
						(account.account_type as any)?.class
					)
				: existingTx.amount;

		// 4. Update account balance (revert old, apply new)
		const balanceDiff = newAmount - existingTx.amount;
		if (balanceDiff !== 0) {
			const { error: balanceError } = await supabase
				.from("accounts")
				.update({ current_balance: account.current_balance + balanceDiff })
				.eq("id", account.id);

			if (balanceError) {
				Logger.error("Failed to update account balance", { error: balanceError });
				return false;
			}
		}

		// 5. Update the transaction record
		const updateData: any = {};
		if (input.description !== undefined) updateData.description = input.description;
		if (input.amount !== undefined) updateData.amount = newAmount;
		if (input.transactionDate !== undefined) updateData.transaction_date = input.transactionDate;
		if (input.transactionType !== undefined) updateData.transaction_type = input.transactionType;

		const { error: updateError } = await supabase
			.from("account_transactions")
			.update(updateData)
			.eq("id", transactionId);

		if (updateError) {
			Logger.error("Failed to update account transaction", { error: updateError });
			// Rollback balance change
			if (balanceDiff !== 0) {
				await supabase.from("accounts").update({ current_balance: account.current_balance }).eq("id", account.id);
			}
			return false;
		}

		// 6. If linked to allocation transaction, update that too
		if (existingTx.linked_allocation_transaction_id) {
			const allocUpdateData: any = {};
			if (input.description !== undefined) allocUpdateData.name = input.description;
			if (input.transactionDate !== undefined) allocUpdateData.transaction_date = input.transactionDate;
			if (input.amount !== undefined) {
				// Allocation amount is always stored as signed (negative for expense)
				const isExpense = ["withdrawal", "payment"].includes(input.transactionType || existingTx.transaction_type);
				allocUpdateData.amount = isExpense ? -Math.abs(input.amount) : Math.abs(input.amount);
			}

			if (Object.keys(allocUpdateData).length > 0) {
				await supabase
					.from("transactions")
					.update(allocUpdateData)
					.eq("id", existingTx.linked_allocation_transaction_id);
			}
		}

		revalidatePath("/balancesheet");
		revalidatePath("/allocations");
		revalidatePath("/dashboard");
		return true;
	} catch (error) {
		Logger.error("Update account transaction error", { error });
		return false;
	}
}

/**
 * Delete an account transaction
 * - Reverts the transaction amount from account balance
 * - If linked to allocation transaction, deletes that too
 */
export async function deleteAccountTransaction(transactionId: string): Promise<boolean> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return false;

		// 1. Get existing transaction
		const { data: existingTx, error: fetchError } = await supabase
			.from("account_transactions")
			.select("*")
			.eq("id", transactionId)
			.eq("user_id", user.id)
			.single();

		if (fetchError || !existingTx) {
			Logger.error("Account transaction not found for deletion", { error: fetchError, transactionId });
			return false;
		}

		// 2. Revert account balance
		const { data: account } = await supabase
			.from("accounts")
			.select("current_balance")
			.eq("id", existingTx.account_id)
			.single();

		if (account) {
			const { error: balanceError } = await supabase
				.from("accounts")
				.update({ current_balance: account.current_balance - existingTx.amount })
				.eq("id", existingTx.account_id);

			if (balanceError) {
				Logger.error("Failed to revert account balance", { error: balanceError });
				return false;
			}
		}

		// 3. Delete linked allocation transaction if exists
		if (existingTx.linked_allocation_transaction_id) {
			await supabase.from("transactions").delete().eq("id", existingTx.linked_allocation_transaction_id);
		}

		// 4. Delete the account transaction
		const { error: deleteError } = await supabase.from("account_transactions").delete().eq("id", transactionId);

		if (deleteError) {
			Logger.error("Failed to delete account transaction", { error: deleteError });
			return false;
		}

		revalidatePath("/balancesheet");
		revalidatePath("/allocations");
		revalidatePath("/dashboard");
		return true;
	} catch (error) {
		Logger.error("Delete account transaction error", { error });
		return false;
	}
}

/**
 * Helper to calculate the actual amount to store based on transaction type and account class
 */
function calculateAccountAmount(
	inputAmount: number,
	txType: string,
	accountClass: "asset" | "liability" | undefined
): number {
	const isAsset = accountClass === "asset";

	if (isAsset) {
		// For assets: deposits/contributions/interest are positive, withdrawals/payments are negative
		if (txType === "deposit" || txType === "contribution" || txType === "interest") {
			return Math.abs(inputAmount);
		} else {
			return -Math.abs(inputAmount);
		}
	} else {
		// For liabilities: payments reduce debt (negative), other transactions increase debt (positive)
		if (txType === "payment") {
			return -Math.abs(inputAmount);
		} else {
			return Math.abs(inputAmount);
		}
	}
}
