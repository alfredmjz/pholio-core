"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
	sampleAccounts,
	sampleAccountTypes,
	sampleAccountTransactions,
	sampleBalanceSheetSummary,
	sampleAccountHistory,
} from "@/mock-data/balancesheet";

import type {
	Account,
	AccountWithType,
	AccountType,
	AccountHistory,
	AccountTransaction,
	BalanceSheetSummary,
	CreateAccountInput,
	UpdateAccountInput,
	RecordTransactionInput,
	CreateAccountTypeInput,
} from "./types";

// ============================================================================
// Account Types
// ============================================================================

/**
 * Get all available account types (system + user-created)
 */
export async function getAccountTypes(): Promise<AccountType[]> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return sampleAccountTypes;
	}
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { data, error } = await supabase
		.from("account_types")
		.select("*")
		.or(`is_system.eq.true,user_id.eq.${user?.id || "00000000-0000-0000-0000-000000000000"}`)
		.eq("is_active", true)
		.order("sort_order", { ascending: true });

	if (error) {
		console.error("Error fetching account types:", error);
		return [];
	}

	return data || [];
}

/**
 * Create a custom account type
 */
export async function createAccountType(input: CreateAccountTypeInput): Promise<AccountType | null> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { data, error } = await supabase
		.from("account_types")
		.insert({
			user_id: user.id,
			...input,
			is_system: false,
		})
		.select()
		.single();

	if (error) {
		console.error("Error creating account type:", error);
		return null;
	}

	revalidatePath("/balancesheet");
	return data;
}

// ============================================================================
// Accounts
// ============================================================================

/**
 * Get all active accounts with their types
 */
export async function getAccounts(): Promise<AccountWithType[]> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return sampleAccounts;
	}
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { data, error } = await supabase
		.from("accounts")
		.select(
			`
			*,
			account_type:account_types(*)
		`
		)
		.eq("user_id", user.id)
		.eq("is_active", true)
		.order("display_order", { ascending: true })
		.order("created_at", { ascending: true });

	if (error) {
		console.error("Error fetching accounts:", error);
		throw new Error("Failed to fetch accounts");
	}

	return data || [];
}

/**
 * Get a single account by ID with its type
 */
export async function getAccountById(id: string): Promise<AccountWithType | null> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return sampleAccounts.find((acc) => acc.id === id) || null;
	}
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { data, error } = await supabase
		.from("accounts")
		.select(
			`
			*,
			account_type:account_types(*)
		`
		)
		.eq("id", id)
		.eq("user_id", user.id)
		.eq("is_active", true)
		.single();

	if (error) {
		console.error("Error fetching account:", error);
		return null;
	}

	return data;
}

/**
 * Get balance sheet summary (totals and grouped accounts)
 */
export async function getBalanceSheetSummary(): Promise<BalanceSheetSummary> {
	const accounts = await getAccounts();

	const assetAccounts = accounts.filter((acc) => acc.account_type?.class === "asset");
	const liabilityAccounts = accounts.filter((acc) => acc.account_type?.class === "liability");

	const totalAssets = assetAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);
	const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);

	return {
		totalAssets,
		totalLiabilities,
		netWorth: totalAssets - totalLiabilities,
		assetAccounts,
		liabilityAccounts,
	};
}

export async function createAccount(input: CreateAccountInput): Promise<AccountWithType | null> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { data, error } = await supabase
		.from("accounts")
		.insert({
			user_id: user.id,
			...input,
		})
		.select(
			`
			*,
			account_type:account_types(*)
		`
		)
		.single();

	if (error) {
		console.error("Error creating account:", error);
		return null;
	}

	revalidatePath("/balancesheet");
	return data;
}

/**
 * Update an existing account
 */
export async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account | null> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { data, error } = await supabase
		.from("accounts")
		.update(input)
		.eq("id", id)
		.eq("user_id", user.id)
		.select()
		.single();

	if (error) {
		console.error("Error updating account:", error);
		return null;
	}

	revalidatePath("/balancesheet");
	return data;
}

/**
 * Soft delete an account (set is_active = false)
 */
export async function deleteAccount(id: string): Promise<boolean> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", id).eq("user_id", user.id);

	if (error) {
		console.error("Error deleting account:", error);
		return false;
	}

	revalidatePath("/balancesheet");
	return true;
}

// ============================================================================
// Transactions
// ============================================================================

/**
 * Record a transaction and update account balance
 */
export async function recordTransaction(input: RecordTransactionInput): Promise<AccountTransaction | null> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	// Get current account with type info
	const { data: account, error: accountError } = await supabase
		.from("accounts")
		.select(
			`
			current_balance,
			track_contribution_room,
			contribution_room,
			account_type:account_types(class)
		`
		)
		.eq("id", input.account_id)
		.eq("user_id", user.id)
		.single();

	if (accountError || !account) {
		console.error("Error fetching account:", accountError);
		return null;
	}

	const accountClass = (account.account_type as any)?.class;

	// Calculate new balance
	let newBalance = account.current_balance;
	if (accountClass === "asset") {
		newBalance +=
			input.transaction_type === "deposit" || input.transaction_type === "contribution" ? input.amount : -input.amount;
	} else {
		newBalance += input.transaction_type === "payment" ? -input.amount : input.amount;
	}

	// Update contribution room if tracking
	let updateData: any = { current_balance: newBalance };
	if (
		account.track_contribution_room &&
		input.transaction_type === "contribution" &&
		account.contribution_room !== null
	) {
		updateData.contribution_room = account.contribution_room - input.amount;
	}

	// Insert transaction
	const { data: transaction, error: transactionError } = await supabase
		.from("account_transactions")
		.insert({
			user_id: user.id,
			...input,
		})
		.select()
		.single();

	if (transactionError) {
		console.error("Error creating transaction:", transactionError);
		return null;
	}

	// Update account balance (and contribution room if applicable)
	const { error: updateError } = await supabase
		.from("accounts")
		.update(updateData)
		.eq("id", input.account_id)
		.eq("user_id", user.id);

	if (updateError) {
		console.error("Error updating account balance:", updateError);
		return null;
	}

	revalidatePath("/balancesheet");
	return transaction;
}

/**
 * Get transactions for an account
 */
export async function getAccountTransactions(accountId: string, limit: number = 50): Promise<AccountTransaction[]> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return sampleAccountTransactions[accountId] || [];
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { data, error } = await supabase
		.from("account_transactions")
		.select("*")
		.eq("account_id", accountId)
		.eq("user_id", user.id)
		.order("transaction_date", { ascending: false })
		.order("created_at", { ascending: false })
		.limit(limit);

	if (error) {
		console.error("Error fetching transactions:", error);
		throw new Error("Failed to fetch transactions");
	}

	return data || [];
}

// ============================================================================
// History
// ============================================================================

/**
 * Get account history for charting
 */
export async function getAccountHistory(accountId: string, limit: number = 30): Promise<AccountHistory[]> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return sampleAccountHistory[accountId] || [];
	}
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { data, error } = await supabase
		.from("account_history")
		.select("*")
		.eq("account_id", accountId)
		.eq("user_id", user.id)
		.order("recorded_at", { ascending: false })
		.limit(limit);

	if (error) {
		console.error("Error fetching account history:", error);
		throw new Error("Failed to fetch account history");
	}

	return data || [];
}

// ============================================================================
// Interest Calculation (For scheduled jobs or manual triggers)
// ============================================================================

/**
 * Apply monthly interest to an account
 */
export async function applyMonthlyInterest(accountId: string): Promise<boolean> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	const { data: account, error: accountError } = await supabase
		.from("accounts")
		.select("current_balance, interest_rate, interest_type")
		.eq("id", accountId)
		.eq("user_id", user.id)
		.single();

	if (accountError || !account || !account.interest_rate) {
		return false;
	}

	let interestAmount = 0;
	if (account.interest_type === "compound" || account.interest_type === "simple") {
		interestAmount = account.current_balance * (account.interest_rate / 12);
	}

	if (interestAmount === 0) {
		return true;
	}

	await recordTransaction({
		account_id: accountId,
		amount: interestAmount,
		transaction_type: "interest",
		description: `Monthly ${account.interest_type} interest`,
	});

	return true;
}
