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
			console.error("Allocation transaction error:", allocError);
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
				console.error("Account transaction error:", acctError);
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
				console.error("Balance update error:", balanceError);
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

		return {
			success: true,
			allocationTransactionId: allocationTxId,
			accountTransactionId: accountTxId,
		};
	} catch (error) {
		console.error("Unified transaction error:", error);
		return { success: false, error: "An unexpected error occurred" };
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
		console.error("Error getting suggested account:", error);
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
		console.error("Error fetching accounts:", error);
		return [];
	}
}
