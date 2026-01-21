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

		let allocationTxId: string | undefined;
		let accountTxId: string | undefined;

		// Step 1: Create allocation transaction (always create for allocations context)
		// For uncategorized, category_id will be null
		const allocAmount = input.type === "income" ? input.amount : -Math.abs(input.amount);

		const { data: allocTx, error: allocError } = await supabase
			.from("transactions")
			.insert({
				user_id: user.id,
				category_id: input.categoryId || null,
				name: input.description,
				amount: allocAmount,
				transaction_date: input.date,
				notes: input.notes || null,
				source: "manual",
			})
			.select("id")
			.single();

		if (allocError) {
			Logger.error("Allocation transaction error", { error: allocError });
			return { success: false, error: "Failed to create budget transaction" };
		}

		allocationTxId = allocTx.id;

		// Step 2: Create account transaction (if account selected)
		if (input.accountId) {
			// Get account to determine transaction type
			const { data: account, error: accountError } = await supabase
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("id", input.accountId)
				.single();

			if (accountError || !account) {
				return { success: false, error: "Account not found" };
			}

			// Determine transaction type and amount based on account class
			const isAsset = (account.account_type as any)?.class === "asset";
			const isLiability = (account.account_type as any)?.class === "liability";

			let txType: string;
			let accountAmount: number;

			if (input.type === "income") {
				// Income increases assets, decreases liabilities (rare)
				txType = isAsset ? "deposit" : "payment";
				accountAmount = input.amount;
			} else {
				// Expense decreases assets, increases liabilities
				if (isAsset) {
					txType = input.transactionType || "withdrawal";
					accountAmount = -Math.abs(input.amount);
				} else {
					txType = input.transactionType || "adjustment";
					accountAmount = Math.abs(input.amount); // Liability increases
				}
			}

			// Insert account transaction
			const { data: acctTx, error: acctError } = await supabase
				.from("account_transactions")
				.insert({
					user_id: user.id,
					account_id: input.accountId,
					amount: accountAmount,
					transaction_type: txType,
					description: input.description,
					transaction_date: input.date,
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
			const { error: balanceError } = await supabase
				.from("accounts")
				.update({
					current_balance: account.current_balance + accountAmount,
				})
				.eq("id", input.accountId);

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

		// 1. Get existing transaction with linked account transaction
		const { data: existingTx, error: fetchError } = await supabase
			.from("transactions")
			.select("*, linked_account_transaction:account_transactions(*)")
			.eq("id", transactionId)
			.single();

		if (fetchError || !existingTx) {
			Logger.error("Transaction not found", { error: fetchError, transactionId });
			return false;
		}

		const existingLinkedTx = existingTx.linked_account_transaction;
		const existingAccountId = existingLinkedTx?.account_id;

		// 2. Update Allocation Transaction
		const allocAmount = input.type === "income" ? input.amount : -Math.abs(input.amount);

		const { error: updateError } = await supabase
			.from("transactions")
			.update({
				name: input.description,
				amount: allocAmount,
				transaction_date: input.date,
				category_id: input.categoryId || null,
				notes: input.notes || null,
			})
			.eq("id", transactionId);

		if (updateError) {
			Logger.error("Failed to update allocation transaction", { error: updateError });
			return false;
		}

		// 3. Handle Account Transaction Logic
		const newAccountId = input.accountId;

		// Helper to adjust account balance safely
		const adjustAccountBalance = async (accId: string, delta: number) => {
			// Fetch current first to ensure atomic-like correctness
			const { data: acc } = await supabase.from("accounts").select("current_balance").eq("id", accId).single();
			if (!acc) return;
			await supabase
				.from("accounts")
				.update({ current_balance: acc.current_balance + delta })
				.eq("id", accId);
		};

		// Case A: Removing Account (Existing -> None)
		if (existingAccountId && !newAccountId) {
			// Revert balance on old account
			await adjustAccountBalance(existingAccountId, -existingLinkedTx.amount);
			// Delete linked transaction
			await supabase.from("account_transactions").delete().eq("id", existingLinkedTx.id);
			// specific unlink on local tx not strictly needed if we assume linked_account_transaction_id is FK'd or we trust the delete cascade
			// but good practice:
			await supabase.from("transactions").update({ linked_account_transaction_id: null }).eq("id", transactionId);
		}

		// Case B: Adding Account (None -> New)
		else if (!existingAccountId && newAccountId) {
			// Create new account transaction logic (reuse from createUnifiedTransaction logic essentially but inline)
			const { data: account } = await supabase
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("id", newAccountId)
				.single();
			if (account) {
				const isAsset = (account.account_type as any)?.class === "asset";
				let txType: string;
				let accountAmount: number;

				if (input.type === "income") {
					txType = isAsset ? "deposit" : "payment";
					accountAmount = input.amount;
				} else {
					if (isAsset) {
						txType = input.transactionType || "withdrawal";
						accountAmount = -Math.abs(input.amount);
					} else {
						txType = input.transactionType || "adjustment";
						accountAmount = Math.abs(input.amount);
					}
				}

				const { data: acctTx } = await supabase
					.from("account_transactions")
					.insert({
						user_id: user.id,
						account_id: newAccountId,
						amount: accountAmount,
						transaction_type: txType,
						description: input.description,
						transaction_date: input.date,
						linked_allocation_transaction_id: transactionId,
					})
					.select("id")
					.single();

				if (acctTx) {
					await adjustAccountBalance(newAccountId, accountAmount);
					await supabase
						.from("transactions")
						.update({ linked_account_transaction_id: acctTx.id })
						.eq("id", transactionId);
				}
			}
		}

		// Case C: Switching Account (Account A -> Account B)
		else if (existingAccountId && newAccountId && existingAccountId !== newAccountId) {
			// 1. Revert Old
			await adjustAccountBalance(existingAccountId, -existingLinkedTx.amount);
			await supabase.from("account_transactions").delete().eq("id", existingLinkedTx.id);

			// 2. Add New
			const { data: account } = await supabase
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("id", newAccountId)
				.single();
			if (account) {
				const isAsset = (account.account_type as any)?.class === "asset";
				let txType: string;
				let accountAmount: number;

				if (input.type === "income") {
					txType = isAsset ? "deposit" : "payment";
					accountAmount = input.amount;
				} else {
					if (isAsset) {
						txType = input.transactionType || "withdrawal";
						accountAmount = -Math.abs(input.amount);
					} else {
						txType = input.transactionType || "adjustment";
						accountAmount = Math.abs(input.amount);
					}
				}

				const { data: acctTx } = await supabase
					.from("account_transactions")
					.insert({
						user_id: user.id,
						account_id: newAccountId,
						amount: accountAmount,
						transaction_type: txType,
						description: input.description,
						transaction_date: input.date,
						linked_allocation_transaction_id: transactionId,
					})
					.select("id")
					.single();

				if (acctTx) {
					await adjustAccountBalance(newAccountId, accountAmount);
					await supabase
						.from("transactions")
						.update({ linked_account_transaction_id: acctTx.id })
						.eq("id", transactionId);
				}
			}
		}

		// Case D: Same Account, potentially different amount/details
		else if (existingAccountId && newAccountId && existingAccountId === newAccountId) {
			const { data: account } = await supabase
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("id", newAccountId)
				.single();
			if (account) {
				const isAsset = (account.account_type as any)?.class === "asset";
				let accountAmount: number;
				if (input.type === "income") {
					accountAmount = input.amount;
				} else {
					if (isAsset) {
						accountAmount = -Math.abs(input.amount);
					} else {
						accountAmount = Math.abs(input.amount);
					}
				}

				// Only update if amount changed or other details
				if (
					accountAmount !== existingLinkedTx.amount ||
					input.description !== existingLinkedTx.description ||
					input.date !== existingLinkedTx.transaction_date
				) {
					const diff = accountAmount - existingLinkedTx.amount;

					await supabase
						.from("account_transactions")
						.update({
							amount: accountAmount,
							description: input.description,
							transaction_date: input.date,
						})
						.eq("id", existingLinkedTx.id);

					if (diff !== 0) {
						await adjustAccountBalance(newAccountId, diff);
					}
				}
			}
		}

		revalidatePath("/allocations");
		revalidatePath("/balancesheet");
		revalidatePath("/dashboard");
		return true;
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

		// 1. Get transaction to check for links
		const { data: existingTx, error } = await supabase
			.from("transactions")
			.select("*, linked_account_transaction:account_transactions(*)")
			.eq("id", transactionId)
			.single();

		if (error || !existingTx) return false;

		// 2. If linked, revert balance and delete account transaction
		if (existingTx.linked_account_transaction) {
			const linkedTx = existingTx.linked_account_transaction;

			// Revert balance
			// We subtract the amount: if it was -50 (spending), we do -(-50) = +50 back to balance
			const { data: acc } = await supabase
				.from("accounts")
				.select("current_balance")
				.eq("id", linkedTx.account_id)
				.single();
			if (acc) {
				await supabase
					.from("accounts")
					.update({ current_balance: acc.current_balance - linkedTx.amount })
					.eq("id", linkedTx.account_id);
			}

			// Delete linked tx
			await supabase.from("account_transactions").delete().eq("id", linkedTx.id);
		}

		// 3. Delete allocation transaction
		await supabase.from("transactions").delete().eq("id", transactionId);

		revalidatePath("/allocations");
		revalidatePath("/balancesheet");
		revalidatePath("/dashboard");
		return true;
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
