"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
	sampleAccounts,
	sampleAccountTypes,
	getSampleAccountTransactions,
	getSampleAccountHistory,
} from "@/mock-data/accounts";
import { Logger } from "@/lib/logger";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { formatDateString } from "@/lib/date-utils";
import { formatAccountDisplayName } from "@/lib/account-utils";
import { getMockRecurringExpenses } from "@/mock-data/recurring";
import type { BalancePoint } from "./account-insights";

import type {
	Account,
	AccountWithType,
	AccountType,
	AccountHistory,
	AccountTransaction,
	CreateAccountInput,
	UpdateAccountInput,
	AccountTypeCode,
	AccountTypeMigrationItem,
	AccountTypeMigrationUpdate,
} from "./types";

/**
 * Get all available account types (system + user-created)
 */
export async function getAccountTypes(): Promise<AccountType[]> {
	if (await isSampleDataMode()) {
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
 * Accounts whose type was retired by migration 006 (or never received a stable `code`).
 * These need the owner to pick a new type through the guided migration dialog.
 *
 * TODO(#99-cleanup): delete along with the banner/dialog once the result set is empty.
 */
export async function getAccountsNeedingTypeMigration(): Promise<AccountTypeMigrationItem[]> {
	if (await isSampleDataMode()) return [];

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return [];

	const { data, error } = await supabase
		.from("accounts")
		.select("*, account_type:account_types(*)")
		.eq("user_id", user.id)
		.eq("is_active", true);

	if (error) {
		Logger.error("Error fetching accounts needing type migration", { error });
		return [];
	}

	return (data || [])
		.filter((account) => !account.account_type?.is_active || !account.account_type?.code)
		.map((account) => ({
			account,
			suggestedCode: suggestCodeForLegacyCategory(account.account_type?.category),
		}));
}

/**
 * Suggestion only - derived from the retired type's stored category, never from its name.
 */
function suggestCodeForLegacyCategory(category?: string | null): AccountTypeCode {
	switch (category) {
		case "investment":
		case "retirement":
			return "investment";
		case "credit":
			return "credit_card";
		case "debt":
			return "loan";
		case "other":
		case "property":
			return "other";
		default:
			return "chequing";
	}
}

/**
 * Applies the owner's type choices. Nothing is changed automatically - the UI always sends
 * an explicit selection per account.
 */
export async function migrateAccountTypes(updates: AccountTypeMigrationUpdate[]): Promise<boolean> {
	if (await isSampleDataMode()) return false;
	if (updates.length === 0) return true;

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return false;

	for (const update of updates) {
		const { error } = await supabase
			.from("accounts")
			.update({
				account_type_id: update.typeId,
				field_visibility: update.fieldVisibility ?? null,
			})
			.eq("id", update.accountId)
			.eq("user_id", user.id);

		if (error) {
			Logger.error("Error migrating account type", { error, accountId: update.accountId });
			return false;
		}
	}

	revalidatePath("/accounts");
	revalidatePath("/dashboard");
	return true;
}

/**
 * Get all active accounts with their types
 */
export async function getAccounts(): Promise<AccountWithType[]> {
	if (await isSampleDataMode()) {
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
	if (await isSampleDataMode()) {
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

export async function createAccount(input: CreateAccountInput): Promise<AccountWithType | null> {
	if (await isSampleDataMode()) {
		return buildSampleAccount(input);
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

	revalidatePath("/accounts");
	return data;
}

/**
 * Builds a mock account for sample-data mode so the create/edit flows can be exercised
 * without touching the database.
 */
function buildSampleAccount(input: CreateAccountInput, id = `account-sample-${Date.now()}`): AccountWithType {
	const accountType = sampleAccountTypes.find((type) => type.id === input.account_type_id) ?? sampleAccountTypes[0];
	const now = new Date().toISOString();

	return {
		id,
		user_id: "sample-user",
		name: input.name,
		account_type_id: accountType.id,
		institution: input.institution ?? null,
		current_balance: input.current_balance,
		// Same default as accounts.currency in the database.
		currency: input.currency ?? "CAD",
		credit_limit: input.credit_limit ?? null,
		original_amount: input.original_amount ?? null,
		interest_rate: input.interest_rate ?? null,
		interest_type: input.interest_type ?? null,
		loan_start_date: input.loan_start_date ?? null,
		loan_term_months: input.loan_term_months ?? null,
		payment_due_date: input.payment_due_date ?? null,
		target_balance: input.target_balance ?? null,
		field_visibility: input.field_visibility ?? null,
		track_contribution_room: input.track_contribution_room ?? false,
		contribution_plan: input.contribution_plan ?? null,
		contribution_room: input.contribution_room ?? null,
		contribution_room_as_of: input.contribution_room_as_of ?? null,
		annual_contribution_limit: input.annual_contribution_limit ?? null,
		overdraft_protection: input.overdraft_protection ?? false,
		overdraft_limit: input.overdraft_limit ?? null,
		overdraft_fee: input.overdraft_fee ?? null,
		nsf_fee: input.nsf_fee ?? null,
		over_limit_fee: input.over_limit_fee ?? null,
		overdraft_interest_rate: input.overdraft_interest_rate ?? null,
		notes: input.notes ?? null,
		color: input.color ?? null,
		icon: input.icon ?? null,
		display_order: sampleAccounts.length,
		is_active: true,
		created_at: now,
		updated_at: now,
		account_type: accountType,
	};
}

/**
 * Update an existing account
 */
export async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account | null> {
	if (await isSampleDataMode()) {
		const existing = sampleAccounts.find((account) => account.id === id);
		if (!existing) return null;
		return { ...existing, ...input, updated_at: new Date().toISOString() };
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
		.update(input)
		.eq("id", id)
		.eq("user_id", user.id)
		.select()
		.single();

	if (error) {
		Logger.error("Error updating account", { error });
		return null;
	}

	revalidatePath("/accounts");
	return data;
}

/**
 * Soft delete an account (set is_active = false)
 */
export async function deleteAccount(id: string): Promise<boolean> {
	if (await isSampleDataMode()) {
		return true;
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	// Hard-delete. A BEFORE DELETE trigger on `accounts` snapshots the row into
	// `deleted_accounts`, and ledger rows keep account_id = NULL so history survives.
	const { data, error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", user.id).select("id");

	if (error || !data || data.length === 0) {
		Logger.error("Error deleting account", { error });
		return false;
	}

	revalidatePath("/accounts");
	revalidatePath("/allocations");
	revalidatePath("/dashboard");
	return true;
}

/**
 * Reorder accounts
 */
export async function reorderAccounts(accountOrders: { id: string; display_order: number }[]): Promise<boolean> {
	// Handle sample data mode
	if (await isSampleDataMode()) {
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

	revalidatePath("/accounts");
	return true;
}

/**
 * Get transactions for an account
 */
export async function getAccountTransactions(accountId: string, limit: number = 50): Promise<AccountTransaction[]> {
	if (await isSampleDataMode()) {
		return getSampleAccountTransactions()[accountId] || [];
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

	return attachTransactionLinks(supabase, (data || []) as AccountTransaction[]);
}

/**
 * Adds each row's budget row (to link to Allocations) and, for a transfer leg, the account on the
 * other side. Read by id: account_transactions has foreign keys both ways with transactions, so an
 * embed would need hints. A transfer's legs share one budget row; older legs may only be linked
 * to each other.
 */
async function attachTransactionLinks(
	supabase: Awaited<ReturnType<typeof createClient>>,
	rows: AccountTransaction[]
): Promise<AccountTransaction[]> {
	const unique = (ids: (string | null | undefined)[]) => Array.from(new Set(ids.filter((id): id is string => !!id)));
	const transfers = rows.filter((row) => row.transaction_type === "transfer");
	const budgetIds = unique(rows.map((row) => row.linked_allocation_transaction_id));
	const transferBudgetIds = unique(transfers.map((row) => row.linked_allocation_transaction_id));
	const pairedLegIds = unique(transfers.map((row) => row.linked_transfer_transaction_id));
	if (budgetIds.length === 0 && pairedLegIds.length === 0) return rows;

	const legColumns = "id, account_id, linked_allocation_transaction_id, account:accounts(id, name, institution)";
	const [budgetResult, sharedLegResult, pairedLegResult] = await Promise.all([
		budgetIds.length
			? supabase.from("transactions").select("id, transaction_date, category:allocation_categories(name)").in("id", budgetIds)
			: Promise.resolve({ data: [], error: null }),
		transferBudgetIds.length
			? supabase.from("account_transactions").select(legColumns).in("linked_allocation_transaction_id", transferBudgetIds)
			: Promise.resolve({ data: [], error: null }),
		pairedLegIds.length
			? supabase.from("account_transactions").select(legColumns).in("id", pairedLegIds)
			: Promise.resolve({ data: [], error: null }),
	]);

	const linkError = budgetResult.error || sharedLegResult.error || pairedLegResult.error;
	if (linkError) {
		Logger.error("Error fetching account transaction links", { error: linkError });
		return rows;
	}

	const budgetById = new Map<string, any>((budgetResult.data ?? []).map((row: any) => [row.id, row]));
	const legs = [...(sharedLegResult.data ?? []), ...(pairedLegResult.data ?? [])] as any[];

	return rows.map((row) => {
		const budget = row.linked_allocation_transaction_id ? budgetById.get(row.linked_allocation_transaction_id) : null;
		const linked: AccountTransaction = {
			...row,
			budget_link: budget
				? { id: budget.id, transaction_date: budget.transaction_date, category_name: budget.category?.name ?? null }
				: null,
		};
		if (row.transaction_type !== "transfer") return linked;

		const otherLeg =
			legs.find((leg) => leg.id === row.linked_transfer_transaction_id) ??
			legs.find(
				(leg) =>
					leg.id !== row.id &&
					row.linked_allocation_transaction_id &&
					leg.linked_allocation_transaction_id === row.linked_allocation_transaction_id
			);
		const otherAccount = otherLeg?.account;
		return {
			...linked,
			transfer_account: otherAccount ? { id: otherAccount.id, label: formatAccountDisplayName(otherAccount) } : null,
		};
	});
}

export interface AccountRecurringItem {
	id: string;
	name: string;
	amount: number;
	billing_period: string;
	next_due_date: string;
	category: string;
}

/** Active bills and subscriptions paid from this account, soonest first. */
export async function getRecurringForAccount(accountId: string): Promise<AccountRecurringItem[]> {
	const pick = (rows: AccountRecurringItem[]) =>
		rows.map(({ id, name, amount, billing_period, next_due_date, category }) => ({
			id,
			name,
			amount: Number(amount),
			billing_period,
			next_due_date: next_due_date.slice(0, 10),
			category,
		}));

	if (await isSampleDataMode()) {
		return pick(getMockRecurringExpenses().filter((item) => item.account_id === accountId && item.is_active !== false)).sort(
			(a, b) => a.next_due_date.localeCompare(b.next_due_date)
		);
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return [];

	const { data, error } = await supabase
		.from("recurring_expenses")
		.select("id, name, amount, billing_period, next_due_date, category")
		.eq("user_id", user.id)
		.eq("account_id", accountId)
		.eq("is_active", true)
		.order("next_due_date", { ascending: true });

	if (error) {
		Logger.error("Error fetching recurring items for account", { error });
		return [];
	}
	return pick(data || []);
}

/**
 * Get account history for charting
 */
export async function getAccountHistory(accountId: string, limit: number = 30): Promise<AccountHistory[]> {
	if (await isSampleDataMode()) {
		return getSampleAccountHistory()[accountId] || [];
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
 * Each account's recorded balances over the last `days` days, for the sparklines on the
 * Accounts page. One query for all accounts, grouped by account id.
 */
export async function getAccountSparklines(days: number = 30): Promise<Record<string, BalancePoint[]>> {
	if (await isSampleDataMode()) {
		const history = getSampleAccountHistory();
		return Object.fromEntries(
			Object.entries(history).map(([id, rows]) => [
				id,
				rows.map((row) => ({ date: String(row.recorded_at).slice(0, 10), balance: Number(row.balance) })),
			])
		);
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return {};

	const since = new Date();
	since.setDate(since.getDate() - days);

	const { data, error } = await supabase
		.from("account_history")
		.select("account_id, balance, recorded_at")
		.eq("user_id", user.id)
		.gte("recorded_at", formatDateString(since))
		.order("recorded_at", { ascending: true });

	if (error) {
		Logger.error("Error fetching account sparklines", { error });
		return {};
	}

	const byAccount: Record<string, BalancePoint[]> = {};
	for (const row of data ?? []) {
		(byAccount[row.account_id] ??= []).push({
			date: String(row.recorded_at).slice(0, 10),
			balance: Number(row.balance),
		});
	}
	return byAccount;
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
	if (await isSampleDataMode()) {
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
