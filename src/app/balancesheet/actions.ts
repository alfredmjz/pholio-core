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
import { Logger } from "@/lib/logger";

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
		Logger.error("Error fetching account types", { error });
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
		Logger.error("Error creating account type", { error });
		return null;
	}

	revalidatePath("/balancesheet");
	return data;
}

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
		Logger.error("Error fetching accounts", { error });
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
		Logger.error("Error fetching account", { error });
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

	// Fetch historical data for charts (last 30 days)
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// Generate all 30 days (including today)
	const generateLast30Days = () => {
		const days: { date: string; dateKey: string }[] = [];
		for (let i = 29; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			days.push({
				date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				dateKey: d.toISOString().split("T")[0], // YYYY-MM-DD for matching
			});
		}
		return days;
	};

	const last30Days = generateLast30Days();

	// Initialize with zeros for all days
	let historicalAssets: { date: string; value: number; hasActivity: boolean }[] = last30Days.map((d) => ({
		date: d.date,
		value: 0,
		hasActivity: false,
	}));
	let historicalLiabilities: { date: string; value: number; hasActivity: boolean }[] = last30Days.map((d) => ({
		date: d.date,
		value: 0,
		hasActivity: false,
	}));

	if (user) {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const { data: history } = await supabase
			.from("account_history")
			.select("balance, recorded_at, account_id")
			.eq("user_id", user.id)
			.gte("recorded_at", thirtyDaysAgo.toISOString().split("T")[0])
			.order("recorded_at", { ascending: true });

		if (history && history.length > 0) {
			const assetAccountIds = new Set(assetAccounts.map((a) => a.id));
			const liabilityAccountIds = new Set(liabilityAccounts.map((a) => a.id));

			// Group by date key (YYYY-MM-DD)
			const assetsByDateKey = new Map<string, number>();
			const liabilitiesByDateKey = new Map<string, number>();

			history.forEach((h) => {
				const dateKey = new Date(h.recorded_at).toISOString().split("T")[0];

				if (assetAccountIds.has(h.account_id)) {
					assetsByDateKey.set(dateKey, (assetsByDateKey.get(dateKey) || 0) + Number(h.balance));
				} else if (liabilityAccountIds.has(h.account_id)) {
					liabilitiesByDateKey.set(dateKey, (liabilitiesByDateKey.get(dateKey) || 0) + Number(h.balance));
				}
			});

			// Update the 30-day arrays with actual values
			historicalAssets = last30Days.map((d) => {
				const value = assetsByDateKey.get(d.dateKey) || 0;
				return { date: d.date, value, hasActivity: value > 0 };
			});

			historicalLiabilities = last30Days.map((d) => {
				const value = liabilitiesByDateKey.get(d.dateKey) || 0;
				return { date: d.date, value, hasActivity: value > 0 };
			});
		}
	}

	return {
		totalAssets,
		totalLiabilities,
		netWorth: totalAssets - totalLiabilities,
		assetAccounts,
		liabilityAccounts,
		historicalAssets,
		historicalLiabilities,
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
		Logger.error("Error creating account", { error });
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
		Logger.error("Error updating account", { error });
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
		Logger.error("Error deleting account", { error });
		return false;
	}

	revalidatePath("/balancesheet");
	return true;
}

/**
 * Reorder accounts
 */
export async function reorderAccounts(accountOrders: { id: string; display_order: number }[]): Promise<boolean> {
	// Handle sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return true;
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	// Update each account's display order
	const promises = accountOrders.map(({ id, display_order }) =>
		supabase.from("accounts").update({ display_order }).eq("id", id).eq("user_id", user.id)
	);

	const results = await Promise.all(promises);

	if (results.some((result) => result.error)) {
		Logger.error("Error reordering accounts");
		return false;
	}

	revalidatePath("/balancesheet");
	return true;
}

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
		Logger.error("Error fetching account for transaction", { error: accountError });
		return null;
	}

	const accountClass = (account.account_type as any)?.class;

	let newBalance = account.current_balance;
	if (accountClass === "asset") {
		newBalance +=
			input.transaction_type === "deposit" || input.transaction_type === "contribution" ? input.amount : -input.amount;
	} else {
		newBalance += input.transaction_type === "payment" ? -input.amount : input.amount;
	}

	let updateData: any = { current_balance: newBalance };
	if (
		account.track_contribution_room &&
		input.transaction_type === "contribution" &&
		account.contribution_room !== null
	) {
		updateData.contribution_room = account.contribution_room - input.amount;
	}

	const { data: transaction, error: transactionError } = await supabase
		.from("account_transactions")
		.insert({
			user_id: user.id,
			...input,
		})
		.select()
		.single();

	if (transactionError) {
		Logger.error("Error creating transaction", { error: transactionError });
		return null;
	}

	const { error: updateError } = await supabase
		.from("accounts")
		.update(updateData)
		.eq("id", input.account_id)
		.eq("user_id", user.id);

	if (updateError) {
		Logger.error("Error updating account balance", { error: updateError });
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
		Logger.error("Error fetching transactions", { error });
		throw new Error("Failed to fetch transactions");
	}

	return data || [];
}

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
		Logger.error("Error fetching account history", { error });
		throw new Error("Failed to fetch account history");
	}

	return data || [];
}

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

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Process monthly interest for all accounts (Called by Cron Job)
 */
export async function processGlobalMonthlyInterest(): Promise<{ success: boolean; processed: number; error?: string }> {
	try {
		const supabase = createAdminClient();

		const { data: accounts, error } = await supabase
			.from("accounts")
			.select("id, current_balance, interest_rate, interest_type, user_id")
			.eq("is_active", true)
			.not("interest_rate", "is", null)
			.gt("interest_rate", 0)
			.in("interest_type", ["simple", "compound"]);

		if (error) {
			Logger.error("Error fetching accounts for interest", { error });
			return { success: false, processed: 0, error: "Failed to fetch accounts" };
		}

		if (!accounts || accounts.length === 0) {
			return { success: true, processed: 0 };
		}

		let processedCount = 0;

		for (const account of accounts) {
			try {
				const interestAmount = account.current_balance * (account.interest_rate / 12);
				if (interestAmount <= 0) continue;

				const { error: txError } = await supabase.from("account_transactions").insert({
					account_id: account.id,
					user_id: account.user_id,
					amount: interestAmount,
					transaction_type: "interest",
					description: `Monthly ${account.interest_type} interest`,
					transaction_date: new Date().toISOString().split("T")[0],
				});

				if (txError) throw txError;

				const { error: updateError } = await supabase
					.from("accounts")
					.update({ current_balance: account.current_balance + interestAmount })
					.eq("id", account.id);

				if (updateError) throw updateError;

				processedCount++;
			} catch (err) {
				Logger.error(`Failed to process interest for account ${account.id}`, { error: err });
			}
		}

		return { success: true, processed: processedCount };
	} catch (error) {
		Logger.error("Failed global interest processing", { error });
		return { success: false, processed: 0, error: "Internal processing error" };
	}
}

export interface RecentActivityItem {
	id: string;
	accountId: string;
	accountName: string;
	type: "transaction" | "account_created";
	transactionType?: string;
	amount?: number;
	description?: string;
	timestamp: string;
}

/**
 * Get recent activity across all accounts (transactions + account creations)
 */
export async function getRecentActivity(limit: number = 10): Promise<RecentActivityItem[]> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return [];
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return [];
	}

	const activity: RecentActivityItem[] = [];

	// Get recent transactions with account names
	const { data: transactions } = await supabase
		.from("account_transactions")
		.select(
			`
			id,
			account_id,
			amount,
			transaction_type,
			description,
			created_at,
			account:accounts(name)
		`
		)
		.eq("user_id", user.id)
		.order("created_at", { ascending: false })
		.limit(limit);

	if (transactions) {
		transactions.forEach((tx) => {
			activity.push({
				id: tx.id,
				accountId: tx.account_id,
				accountName: (tx.account as any)?.name || "Unknown Account",
				type: "transaction",
				transactionType: tx.transaction_type,
				amount: tx.amount,
				description: tx.description || undefined,
				timestamp: tx.created_at,
			});
		});
	}

	// Get recently created accounts
	const { data: accounts } = await supabase
		.from("accounts")
		.select("id, name, created_at")
		.eq("user_id", user.id)
		.eq("is_active", true)
		.order("created_at", { ascending: false })
		.limit(limit);

	if (accounts) {
		accounts.forEach((acc) => {
			activity.push({
				id: `account-${acc.id}`,
				accountId: acc.id,
				accountName: acc.name,
				type: "account_created",
				timestamp: acc.created_at,
			});
		});
	}

	// Sort by timestamp descending and limit
	activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

	return activity.slice(0, limit);
}
