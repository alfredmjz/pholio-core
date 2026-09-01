"use server";

/**
 * Unified Transaction Actions
 *
 * Server actions for creating transactions that update BOTH:
 * - Budget allocations (transactions table)
 * - Account balances (account_transactions table + accounts.current_balance)
 *
 * This eliminates duplicate data entry and ensures consistency.
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
	UnifiedTransactionInput,
	UnifiedTransactionResult,
	SuggestedAccount,
} from "@/lib/types/unified-transaction";
import type { AccountWithType } from "@/app/balancesheet/types";
import { Logger } from "@/lib/logger";

/**
 * Create a unified transaction that updates both budget and account balance
 */
export async function createUnifiedTransaction(input: UnifiedTransactionInput): Promise<UnifiedTransactionResult> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "Unauthorized" };
		}

		// Defensive check for Next.js serialization quirk
		const categoryId = input.categoryId === "$undefined" ? null : (input.categoryId ?? null);
		const accountId = input.accountId === "$undefined" ? null : (input.accountId ?? null);
		const fromAccountId = input.fromAccountId === "$undefined" ? null : (input.fromAccountId ?? null);
		const toAccountId = input.toAccountId === "$undefined" ? null : (input.toAccountId ?? null);

		const normalizedInput = {
			...input,
			categoryId,
			accountId,
			fromAccountId,
			toAccountId,
		};

		let allocationTxId: string | undefined;
		let accountTxId: string | undefined;

		// Handle Transfer Transaction Type
		if (normalizedInput.type === "transfer") {
			if (!normalizedInput.fromAccountId || !normalizedInput.toAccountId) {
				return { success: false, error: "Please select both source and destination accounts for the transfer" };
			}
			if (normalizedInput.fromAccountId === normalizedInput.toAccountId) {
				return { success: false, error: "Source and destination accounts must be different" };
			}

			// Step 1: Create allocation transaction (source = 'transfer', category = null)
			const { data: allocTx, error: allocError } = await supabase
				.from("transactions")
				.insert({
					user_id: user.id,
					category_id: null,
					name: normalizedInput.description,
					amount: Math.abs(normalizedInput.amount),
					transaction_date: normalizedInput.date,
					notes: normalizedInput.notes || null,
					source: "transfer",
				})
				.select("id")
				.single();

			if (allocError || !allocTx) {
				Logger.error("Transfer allocation transaction error", { error: allocError });
				return { success: false, error: "Failed to create transfer transaction record" };
			}

			allocationTxId = allocTx.id;

			// Fetch accounts
			const { data: fromAccount } = await supabase
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("id", normalizedInput.fromAccountId)
				.single();

			const { data: toAccount } = await supabase
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("id", normalizedInput.toAccountId)
				.single();

			if (!fromAccount || !toAccount) {
				await supabase.from("transactions").delete().eq("id", allocationTxId);
				return { success: false, error: "One or both selected accounts were not found" };
			}

			const isFromAsset = (fromAccount.account_type as any)?.class === "asset";
			const isToAsset = (toAccount.account_type as any)?.class === "asset";

			const fromAccountAmount = isFromAsset ? -Math.abs(normalizedInput.amount) : Math.abs(normalizedInput.amount);
			const toAccountAmount = isToAsset ? Math.abs(normalizedInput.amount) : -Math.abs(normalizedInput.amount);

			// Step 2: Create Source Account Transaction (Withdrawal/Charge)
			const { data: fromAcctTx, error: fromAcctError } = await supabase
				.from("account_transactions")
				.insert({
					user_id: user.id,
					account_id: normalizedInput.fromAccountId,
					amount: fromAccountAmount,
					transaction_type: "transfer",
					description: normalizedInput.description || `Transfer to ${toAccount.name}`,
					transaction_date: normalizedInput.date,
					linked_allocation_transaction_id: allocationTxId,
				})
				.select("id")
				.single();

			if (fromAcctError || !fromAcctTx) {
				Logger.error("Source account transfer transaction error", { error: fromAcctError });
				await supabase.from("transactions").delete().eq("id", allocationTxId);
				return { success: false, error: "Failed to process transfer from source account" };
			}

			accountTxId = fromAcctTx.id;
			await adjustAccountBalance(supabase, normalizedInput.fromAccountId, fromAccountAmount);

			// Step 3: Create Destination Account Transaction (Deposit/Payment)
			const { data: toAcctTx, error: toAcctError } = await supabase
				.from("account_transactions")
				.insert({
					user_id: user.id,
					account_id: normalizedInput.toAccountId,
					amount: toAccountAmount,
					transaction_type: "transfer",
					description: normalizedInput.description || `Transfer from ${fromAccount.name}`,
					transaction_date: normalizedInput.date,
					linked_allocation_transaction_id: allocationTxId,
				})
				.select("id")
				.single();

			if (toAcctError || !toAcctTx) {
				Logger.error("Destination account transfer transaction error", { error: toAcctError });
				// Rollback source account transaction & balance
				await adjustAccountBalance(supabase, normalizedInput.fromAccountId, -fromAccountAmount);
				await supabase.from("account_transactions").delete().eq("id", fromAcctTx.id);
				await supabase.from("transactions").delete().eq("id", allocationTxId);
				return { success: false, error: "Failed to process transfer to destination account" };
			}

			await adjustAccountBalance(supabase, normalizedInput.toAccountId, toAccountAmount);

			// Step 4: Link source transaction to destination transaction & link allocation transaction
			try {
				await supabase
					.from("account_transactions")
					.update({ linked_transfer_transaction_id: toAcctTx.id })
					.eq("id", fromAcctTx.id);

				await supabase
					.from("account_transactions")
					.update({ linked_transfer_transaction_id: fromAcctTx.id })
					.eq("id", toAcctTx.id);
			} catch (linkErr) {
				Logger.warn("Optional transfer linking failed", { error: linkErr });
			}

			await supabase
				.from("transactions")
				.update({ linked_account_transaction_id: fromAcctTx.id })
				.eq("id", allocationTxId);

			revalidatePath("/allocations");
			revalidatePath("/balancesheet");
			revalidatePath("/dashboard");

			return {
				success: true,
				allocationTransactionId: allocationTxId,
				accountTransactionId: fromAcctTx.id,
			};
		}

		// Step 1: Create allocation transaction (Income / Expense)
		const allocAmount = normalizedInput.type === "income" ? normalizedInput.amount : -Math.abs(normalizedInput.amount);

		const { data: allocTx, error: allocError } = await supabase
			.from("transactions")
			.insert({
				user_id: user.id,
				category_id: normalizedInput.categoryId,
				name: normalizedInput.description,
				amount: allocAmount,
				transaction_date: normalizedInput.date,
				notes: normalizedInput.notes || null,
				source: normalizedInput.source || "manual",
			})
			.select("id")
			.single();

		if (allocError) {
			Logger.error("Allocation transaction error", { error: allocError });
			return { success: false, error: "Failed to create budget transaction" };
		}

		allocationTxId = allocTx.id;

		// Step 2: Create account transaction (if account selected)
		if (normalizedInput.accountId) {
			// Get account to determine transaction type
			const { data: account, error: accountError } = await supabase
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("id", normalizedInput.accountId)
				.single();

			if (accountError || !account) {
				return { success: false, error: "Account not found" };
			}

			const { txType, accountAmount } = calculateTransactionDetails(account, normalizedInput);

			// Insert account transaction
			const { data: acctTx, error: acctError } = await supabase
				.from("account_transactions")
				.insert({
					user_id: user.id,
					account_id: normalizedInput.accountId,
					amount: accountAmount,
					transaction_type: txType,
					description: normalizedInput.description,
					transaction_date: normalizedInput.date,
					linked_allocation_transaction_id: allocationTxId || null,
				})
				.select("id")
				.single();

			if (acctError) {
				Logger.error("Account transaction error", { error: acctError });
				// Rollback allocation transaction if account transaction fails
				if (allocationTxId) {
					await supabase.from("transactions").delete().eq("id", allocationTxId);
				}
				return { success: false, error: "Failed to create account transaction" };
			}

			accountTxId = acctTx.id;

			// Step 3: Update account balance
			const { error: balanceError } = await adjustAccountBalance(supabase, normalizedInput.accountId, accountAmount);

			if (balanceError) {
				Logger.error("Balance update error", { error: balanceError });
				// Rollback both transactions
				if (allocationTxId) {
					await supabase.from("transactions").delete().eq("id", allocationTxId);
				}
				if (accountTxId) {
					await supabase.from("account_transactions").delete().eq("id", accountTxId);
				}
				return { success: false, error: "Failed to update account balance" };
			}

			// Step 4: Update bidirectional link (optional)
			if (allocationTxId && accountTxId) {
				await supabase
					.from("transactions")
					.update({ linked_account_transaction_id: accountTxId })
					.eq("id", allocationTxId);
			}
		}

		// Revalidate relevant pages
		revalidatePath("/allocations");
		revalidatePath("/balancesheet");
		revalidatePath("/dashboard");

		return {
			success: true,
			allocationTransactionId: allocationTxId,
			accountTransactionId: accountTxId,
		};
	} catch (error) {
		Logger.error("Unified transaction error", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

/**
 * Update a unified transaction
 * Handles:
 * - Basic updates (name, date, etc)
 * - Amount changes (updates account balance)
 * - Account moves (reverts old, applies to new)
 * - Account add/remove
 */
export async function updateUnifiedTransaction(
	transactionId: string,
	input: UnifiedTransactionInput
): Promise<boolean> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return false;

		// Defensive check for Next.js serialization quirk
		const categoryId = input.categoryId === "$undefined" ? null : (input.categoryId ?? null);
		const accountId = input.accountId === "$undefined" ? null : (input.accountId ?? null);

		const normalizedInput = {
			...input,
			categoryId,
			accountId,
		};

		const { data, error } = await supabase.rpc("update_unified_transaction", {
			p_transaction_id: transactionId,
			p_input: normalizedInput,
		});

		if (error) {
			Logger.error("Update unified transaction RPC error", { error });
			return false;
		}

		revalidatePath("/allocations");
		revalidatePath("/balancesheet");
		revalidatePath("/dashboard");
		return data as boolean;
	} catch (error) {
		Logger.error("Update unified transaction error", { error });
		return false;
	}
}

/**
 * Delete a unified transaction
 * - Deletes allocation transaction
 * - Deletes linked account transaction (if any) and reverts balance
 */
export async function deleteUnifiedTransaction(transactionId: string): Promise<boolean> {
	try {
		const supabase = await createClient();

		const { data, error } = await supabase.rpc("delete_unified_transaction", {
			p_transaction_id: transactionId,
		});

		if (error) {
			Logger.error("Delete unified transaction RPC error", { error });
			return false;
		}

		revalidatePath("/allocations");
		revalidatePath("/balancesheet");
		revalidatePath("/dashboard");
		return data as boolean;
	} catch (error) {
		Logger.error("Delete unified transaction error", { error });
		return false;
	}
}

/**
 * Get suggested account for a category (based on category type and linked_account_id)
 */
export async function getSuggestedAccountForCategory(categoryId: string): Promise<SuggestedAccount | null> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return null;

		const { data: category } = await supabase
			.from("allocation_categories")
			.select("id, category_type, linked_account_id")
			.eq("id", categoryId)
			.eq("user_id", user.id)
			.single();

		if (!category || !category.linked_account_id) {
			return { categoryId, accountId: null, reason: "none" };
		}

		// Fetch the linked account
		const { data: account } = await supabase
			.from("accounts")
			.select("*, account_type:account_types(*)")
			.eq("id", category.linked_account_id)
			.single();

		const reason =
			category.category_type === "savings_goal"
				? "linked_savings_goal"
				: category.category_type === "debt_payment"
					? "linked_debt_payment"
					: "none";

		return {
			categoryId,
			accountId: category.linked_account_id,
			account: account as AccountWithType | undefined,
			reason,
		};
	} catch (error) {
		Logger.error("Error getting suggested account", { error });
		return null;
	}
}

/**
 * Get all accounts for account selector dropdown
 */
export async function getAccountsForSelector(): Promise<AccountWithType[]> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return [];

		const { data: accounts } = await supabase
			.from("accounts")
			.select("*, account_type:account_types(*)")
			.eq("user_id", user.id)
			.eq("is_active", true)
			.order("display_order");

		return (accounts as AccountWithType[]) || [];
	} catch (error) {
		Logger.error("Error fetching accounts", { error });
		return [];
	}
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate transaction type and signed amount based on account and input
 */
function calculateTransactionDetails(
	account: any,
	input: Pick<UnifiedTransactionInput, "type" | "amount" | "transactionType">
) {
	const isAsset = (account.account_type as any)?.class === "asset";
	let txType: string;

	if (input.type === "income") {
		txType = input.transactionType || (isAsset ? "deposit" : "payment");
	} else {
		txType = input.transactionType || (isAsset ? "withdrawal" : "adjustment");
	}

	let accountAmount: number;
	if (isAsset) {
		// For assets: deposits, contributions, refunds, and interest ADD to the balance
		if (txType === "deposit" || txType === "contribution" || txType === "refund" || txType === "interest") {
			accountAmount = Math.abs(input.amount);
		} else {
			// Withdrawals and payments SUBTRACT from the balance
			accountAmount = -Math.abs(input.amount);
		}
	} else {
		// For liabilities (loans, credit cards):
		// Payments and refunds REDUCE the debt (negative amount)
		if (txType === "payment" || txType === "refund") {
			accountAmount = -Math.abs(input.amount);
		} else {
			// Charges, withdrawals, interest, fees INCREASE the debt (positive amount)
			accountAmount = Math.abs(input.amount);
		}
	}

	return { txType, accountAmount };
}

/**
 * Adjust account balance safely
 */
async function adjustAccountBalance(supabase: any, accountId: string, delta: number): Promise<{ error?: any }> {
	const { data: acc, error: fetchError } = await supabase
		.from("accounts")
		.select("current_balance")
		.eq("id", accountId)
		.single();
	if (fetchError || !acc) return { error: fetchError || "Account not found" };

	const { error: updateError } = await supabase
		.from("accounts")
		.update({ current_balance: acc.current_balance + delta })
		.eq("id", accountId);

	return { error: updateError };
}
