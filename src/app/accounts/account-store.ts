import { Logger } from "@/lib/logger";
import type { DataContext, DemoContext, SupabaseContext } from "@/lib/data-context.server";
import { formatDateString } from "@/lib/date-utils";
import { formatAccountDisplayName } from "@/lib/account-utils";
import type { StatementLedgerRow } from "@/lib/credit-card-statement";
import {
	sampleAccounts,
	sampleAccountTypes,
	getSampleAccountHistory,
	getSampleAccountTransactions,
	getSampleRecentActivity,
} from "@/mock-data/accounts";
import { getMockRecurringExpenses } from "@/mock-data/recurring";
import type { BalancePoint } from "./account-insights";
import type { AccountRecurringItem, RecentActivityItem } from "./actions";
import type {
	Account,
	AccountHistory,
	AccountTransaction,
	AccountType,
	AccountWithType,
	CreateAccountInput,
	UpdateAccountInput,
} from "./types";

const ACCOUNT_WITH_TYPE = "*, account_type:account_types(*)";

export interface AccountStore {
	listTypes(): Promise<AccountType[]>;
	/** Active accounts with their type, in display order. */
	list(): Promise<AccountWithType[]>;
	get(id: string): Promise<AccountWithType | null>;
	create(input: CreateAccountInput): Promise<AccountWithType>;
	getBalance(id: string): Promise<number | null>;
	/** Returns null when no such account exists. */
	update(id: string, input: UpdateAccountInput): Promise<Account | null>;
	/** Returns false when no such account exists. */
	remove(id: string): Promise<boolean>;
	setDisplayOrder(orders: { id: string; display_order: number }[]): Promise<void>;
	setType(accountId: string, typeId: string, fieldVisibility: UpdateAccountInput["field_visibility"]): Promise<void>;
	insertDeposit(accountId: string, amount: number, date: string): Promise<void>;
	listTransactions(accountId: string, limit: number): Promise<AccountTransaction[]>;
	listTransactionsSince(accountId: string, since: string): Promise<StatementLedgerRow[]>;
	listRecurring(accountId: string): Promise<AccountRecurringItem[]>;
	listHistory(accountId: string, limit: number): Promise<AccountHistory[]>;
	sparklines(days: number): Promise<Record<string, BalancePoint[]>>;
	recentActivity(limit: number): Promise<RecentActivityItem[]>;
}

export function accountStore(ctx: DataContext): AccountStore {
	return ctx.kind === "demo" ? demoAccountStore(ctx) : supabaseAccountStore(ctx);
}

type RecurringForAccountRow = Omit<AccountRecurringItem, "direction"> & { to_account_id?: string | null };

function pickRecurring(accountId: string, rows: RecurringForAccountRow[]): AccountRecurringItem[] {
	return rows
		.map(({ id, name, amount, billing_period, next_due_date, category, to_account_id }) => ({
			id,
			name,
			amount: Number(amount),
			billing_period,
			next_due_date: next_due_date.slice(0, 10),
			category,
			direction: (to_account_id === accountId ? "in" : "out") as AccountRecurringItem["direction"],
		}))
		.sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
}

function supabaseAccountStore({ db, userId }: SupabaseContext): AccountStore {
	/**
	 * Adds each row's budget row (to link to Allocations) and, for a transfer leg, the account on the
	 * other side. Read by id: account_transactions has foreign keys both ways with transactions, so an
	 * embed would need hints. A transfer's legs share one budget row; older legs may only be linked
	 * to each other.
	 */
	async function attachTransactionLinks(rows: AccountTransaction[]): Promise<AccountTransaction[]> {
		const unique = (ids: (string | null | undefined)[]) => Array.from(new Set(ids.filter((id): id is string => !!id)));
		const transfers = rows.filter((row) => row.transaction_type === "transfer");
		const budgetIds = unique(rows.map((row) => row.linked_allocation_transaction_id));
		const transferBudgetIds = unique(transfers.map((row) => row.linked_allocation_transaction_id));
		const pairedLegIds = unique(transfers.map((row) => row.linked_transfer_transaction_id));
		if (budgetIds.length === 0 && pairedLegIds.length === 0) return rows;

		const legColumns = "id, account_id, linked_allocation_transaction_id, account:accounts(id, name, institution)";
		const [budgetResult, sharedLegResult, pairedLegResult] = await Promise.all([
			budgetIds.length
				? db
						.from("transactions")
						.select("id, transaction_date, category:allocation_categories(name)")
						.in("id", budgetIds)
				: Promise.resolve({ data: [], error: null }),
			transferBudgetIds.length
				? db.from("account_transactions").select(legColumns).in("linked_allocation_transaction_id", transferBudgetIds)
				: Promise.resolve({ data: [], error: null }),
			pairedLegIds.length
				? db.from("account_transactions").select(legColumns).in("id", pairedLegIds)
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

	return {
		async listTypes() {
			const { data, error } = await db
				.from("account_types")
				.select("*")
				.or(`is_system.eq.true,user_id.eq.${userId}`)
				.eq("is_active", true)
				.order("sort_order", { ascending: true });
			if (error) {
				Logger.error("Error fetching account types", { error });
				return [];
			}
			return data || [];
		},

		async list() {
			const { data, error } = await db
				.from("accounts")
				.select(ACCOUNT_WITH_TYPE)
				.eq("user_id", userId)
				.eq("is_active", true)
				.order("display_order", { ascending: true })
				.order("created_at", { ascending: true });
			if (error) {
				Logger.error("Error fetching accounts", { error });
				throw new Error("Failed to fetch accounts");
			}
			return data || [];
		},

		async get(id) {
			const { data, error } = await db
				.from("accounts")
				.select(ACCOUNT_WITH_TYPE)
				.eq("id", id)
				.eq("user_id", userId)
				.eq("is_active", true)
				.single();
			if (error) {
				Logger.error("Error fetching account", { error });
				return null;
			}
			return data;
		},

		async create(input) {
			const { data, error } = await db
				.from("accounts")
				.insert({ user_id: userId, ...input })
				.select(ACCOUNT_WITH_TYPE)
				.single();
			if (error) throw error;
			return data;
		},

		async getBalance(id) {
			const { data } = await db.from("accounts").select("current_balance").eq("id", id).eq("user_id", userId).single();
			return data ? Number(data.current_balance) : null;
		},

		async update(id, input) {
			const { data, error } = await db
				.from("accounts")
				.update(input)
				.eq("id", id)
				.eq("user_id", userId)
				.select()
				.maybeSingle();
			if (error) throw error;
			return data;
		},

		async remove(id) {
			// Hard-delete. A BEFORE DELETE trigger on `accounts` snapshots the row into
			// `deleted_accounts`, and ledger rows keep account_id = NULL so history survives.
			const { data, error } = await db.from("accounts").delete().eq("id", id).eq("user_id", userId).select("id");
			if (error) throw error;
			return Boolean(data && data.length > 0);
		},

		async setDisplayOrder(orders) {
			const results = await Promise.all(
				orders.map(({ id, display_order }) =>
					db.from("accounts").update({ display_order }).eq("id", id).eq("user_id", userId)
				)
			);
			const failed = results.find((result) => result.error);
			if (failed?.error) throw failed.error;
		},

		async setType(accountId, typeId, fieldVisibility) {
			const { error } = await db
				.from("accounts")
				.update({ account_type_id: typeId, field_visibility: fieldVisibility ?? null })
				.eq("id", accountId)
				.eq("user_id", userId);
			if (error) throw error;
		},

		async insertDeposit(accountId, amount, date) {
			const { error } = await db.from("account_transactions").insert({
				user_id: userId,
				account_id: accountId,
				amount,
				transaction_type: "deposit",
				description: "Balance update",
				transaction_date: date,
			});
			if (error) throw error;
		},

		async listTransactions(accountId, limit) {
			const { data, error } = await db
				.from("account_transactions")
				.select("*")
				.eq("account_id", accountId)
				.eq("user_id", userId)
				.order("transaction_date", { ascending: false })
				.order("created_at", { ascending: false })
				.limit(limit);
			if (error) {
				Logger.error("Error fetching transactions", { error });
				throw new Error("Failed to fetch transactions");
			}
			return attachTransactionLinks((data || []) as AccountTransaction[]);
		},

		async listTransactionsSince(accountId, since) {
			const { data, error } = await db
				.from("account_transactions")
				.select("amount, transaction_date")
				.eq("account_id", accountId)
				.eq("user_id", userId)
				.gte("transaction_date", since);
			if (error) {
				Logger.error("Error fetching statement transactions", { error });
				throw new Error("Failed to fetch transactions");
			}
			return (data || []).map((row) => ({ amount: Number(row.amount), transaction_date: row.transaction_date }));
		},

		async listRecurring(accountId) {
			const columns = "id, name, amount, billing_period, next_due_date, category, to_account_id";
			const [outgoing, incoming] = await Promise.all([
				db
					.from("recurring_expenses")
					.select(columns)
					.eq("user_id", userId)
					.eq("account_id", accountId)
					.eq("is_active", true),
				db
					.from("recurring_expenses")
					.select(columns)
					.eq("user_id", userId)
					.eq("category", "transfer")
					.eq("to_account_id", accountId)
					.eq("is_active", true),
			]);

			const error = outgoing.error ?? incoming.error;
			if (error) {
				Logger.error("Error fetching recurring items for account", { error });
				return [];
			}
			return pickRecurring(accountId, [...(outgoing.data || []), ...(incoming.data || [])]);
		},

		async listHistory(accountId, limit) {
			const { data, error } = await db
				.from("account_history")
				.select("*")
				.eq("account_id", accountId)
				.eq("user_id", userId)
				.order("recorded_at", { ascending: false })
				.limit(limit);
			if (error) {
				Logger.error("Error fetching account history", { error });
				throw new Error("Failed to fetch account history");
			}
			return data || [];
		},

		async sparklines(days) {
			const since = new Date();
			since.setDate(since.getDate() - days);

			const { data, error } = await db
				.from("account_history")
				.select("account_id, balance, recorded_at")
				.eq("user_id", userId)
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
		},

		async recentActivity(limit) {
			const activity: RecentActivityItem[] = [];

			const { data: transactions } = await db
				.from("account_transactions")
				.select("id, account_id, amount, transaction_type, description, created_at, account:accounts(name)")
				.eq("user_id", userId)
				.order("created_at", { ascending: false })
				.limit(limit);

			for (const tx of transactions ?? []) {
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
			}

			const { data: accounts } = await db
				.from("accounts")
				.select("id, name, created_at")
				.eq("user_id", userId)
				.eq("is_active", true)
				.order("created_at", { ascending: false })
				.limit(limit);

			for (const acc of accounts ?? []) {
				activity.push({
					id: `account-${acc.id}`,
					accountId: acc.id,
					accountName: acc.name,
					type: "account_created",
					timestamp: acc.created_at,
				});
			}

			activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
			return activity.slice(0, limit);
		},
	};
}

/** Builds a mock account so the create/edit flows can be exercised without a database. */
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
		statement_day: input.statement_day ?? null,
		statement_balance: input.statement_balance ?? null,
		statement_balance_date: input.statement_balance_date ?? null,
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
 * Demo accounts are the fixed sample set: the browser keeps the visitor's own edits (see the demo
 * store), so create and update only echo what the sample data would look like, and the rest are no-ops.
 */
function demoAccountStore(_ctx: DemoContext): AccountStore {
	return {
		async listTypes() {
			return sampleAccountTypes;
		},
		async list() {
			return sampleAccounts;
		},
		async get(id) {
			return sampleAccounts.find((account) => account.id === id) ?? null;
		},
		async create(input) {
			return buildSampleAccount(input);
		},
		async getBalance() {
			return null;
		},
		async update(id, input) {
			const existing = sampleAccounts.find((account) => account.id === id);
			return existing ? { ...existing, ...input, updated_at: new Date().toISOString() } : null;
		},
		async remove() {
			return true;
		},
		async setDisplayOrder() {},
		async setType() {},
		async insertDeposit() {},
		async listTransactions(accountId) {
			return getSampleAccountTransactions()[accountId] || [];
		},
		async listTransactionsSince(accountId, since) {
			return (getSampleAccountTransactions()[accountId] || []).filter((tx) => tx.transaction_date >= since);
		},
		async listRecurring(accountId) {
			return pickRecurring(
				accountId,
				getMockRecurringExpenses().filter(
					(item) =>
						(item.account_id === accountId || (item.category === "transfer" && item.to_account_id === accountId)) &&
						item.is_active !== false
				)
			);
		},
		async listHistory(accountId) {
			return getSampleAccountHistory()[accountId] || [];
		},
		async sparklines() {
			return Object.fromEntries(
				Object.entries(getSampleAccountHistory()).map(([id, rows]) => [
					id,
					rows.map((row) => ({ date: String(row.recorded_at).slice(0, 10), balance: Number(row.balance) })),
				])
			);
		},
		async recentActivity(limit) {
			return getSampleRecentActivity().slice(0, limit);
		},
	};
}
