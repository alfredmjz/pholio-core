import { ActionError, DEMO_READONLY_ERROR } from "@/lib/action-result";
import { Logger } from "@/lib/logger";
import type { DataContext, DemoContext, SupabaseContext } from "@/lib/data-context.server";
import { sampleAccounts } from "@/mock-data/accounts";
import type { AccountWithType } from "@/app/accounts/types";

export interface NewBudgetRow {
	categoryId: string | null;
	name: string;
	amount: number;
	date: string;
	notes: string | null;
	source: string;
}

export interface NewLedgerLeg {
	accountId: string;
	/** Signed change to the account balance. */
	amount: number;
	transactionType: string;
	description: string;
	date: string;
	isCashAdvance?: boolean;
	interestPeriod?: string;
	/** Index of the other leg of a transfer in the same post. */
	transferPair?: number;
}

export interface PostedEntries {
	budgetRowId: string | null;
	legIds: string[];
}

export interface LedgerRow {
	id: string;
	account_id: string;
	amount: number;
	transaction_type: string;
	linked_allocation_transaction_id: string | null;
}

export interface LedgerRowPatch {
	description?: string;
	amount?: number;
	transaction_date?: string;
	transaction_type?: string;
}

export interface BudgetRowPatch {
	name?: string;
	transaction_date?: string;
	amount?: number;
}

/** A saved budget row and the ledger legs it moved, so an edit can be capped without its own effect. */
export interface SavedBudgetRow {
	id: string;
	source: string | null;
	recurringExpenseId: string | null;
	legs: { accountId: string; amount: number }[];
}

export interface TransactionStore {
	listSelectableAccounts(): Promise<AccountWithType[]>;
	/** Previously used descriptions (budget, ledger, presets, recurring), without "transfer". */
	listUsedDescriptions(): Promise<string[]>;
	getAccount(id: string): Promise<AccountWithType | null>;
	getBudgetRow(id: string): Promise<SavedBudgetRow | null>;
	/** post_ledger_entries(): the budget row, its legs, their links and balance changes in one transaction. */
	postEntries(budgetRow: NewBudgetRow | null, legs: NewLedgerLeg[]): Promise<PostedEntries>;
	updateBudgetRow(id: string, patch: BudgetRowPatch): Promise<void>;
	deleteBudgetRow(id: string): Promise<void>;
	getLedgerRow(id: string): Promise<LedgerRow | null>;
	updateLedgerRow(id: string, patch: LedgerRowPatch): Promise<void>;
	deleteLedgerRow(id: string): Promise<void>;
	setBalance(accountId: string, balance: number): Promise<void>;
	/** update_unified_transaction(): false when the row is missing or the edit is rejected. */
	updateUnified(id: string, input: Record<string, unknown>): Promise<boolean>;
	/** delete_unified_transaction(): false when the row is missing. */
	deleteUnified(id: string): Promise<boolean>;
}

export function transactionStore(ctx: DataContext): TransactionStore {
	return ctx.kind === "demo" ? demoTransactionStore(ctx) : supabaseTransactionStore(ctx);
}

/** Arguments for post_ledger_entries(), shared with the interest job's admin client. */
export function ledgerEntriesArgs(budgetRow: NewBudgetRow | null, legs: NewLedgerLeg[]) {
	return {
		p_budget_row: budgetRow && {
			category_id: budgetRow.categoryId,
			name: budgetRow.name,
			amount: budgetRow.amount,
			transaction_date: budgetRow.date,
			notes: budgetRow.notes,
			source: budgetRow.source,
		},
		p_legs: legs.map((leg) => ({
			account_id: leg.accountId,
			amount: leg.amount,
			transaction_type: leg.transactionType,
			description: leg.description,
			transaction_date: leg.date,
			is_cash_advance: !!leg.isCashAdvance,
			interest_period: leg.interestPeriod ?? null,
			transfer_pair: leg.transferPair ?? null,
		})),
	};
}

export function toPostedEntries(data: unknown): PostedEntries {
	const result = (data ?? {}) as { budget_row_id?: string | null; leg_ids?: string[] | null };
	return { budgetRowId: result.budget_row_id ?? null, legIds: result.leg_ids ?? [] };
}

function addDescription(set: Set<string>, value: string | null | undefined, skipTransfer: boolean) {
	const text = value?.trim();
	if (!text) return;
	if (skipTransfer && text.toLowerCase() === "transfer") return;
	set.add(text);
}

function supabaseTransactionStore({ db, userId }: SupabaseContext): TransactionStore {
	return {
		async listSelectableAccounts() {
			const { data, error } = await db
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("user_id", userId)
				.eq("is_active", true)
				.order("display_order");
			if (error) {
				Logger.error("Error fetching accounts", { error });
				return [];
			}
			return (data as AccountWithType[]) ?? [];
		},

		async listUsedDescriptions() {
			const [allocRes, acctRes, presetRes, recRes] = await Promise.all([
				db
					.from("transactions")
					.select("name")
					.eq("user_id", userId)
					.not("name", "is", null)
					.order("created_at", { ascending: false })
					.limit(100),
				db
					.from("account_transactions")
					.select("description")
					.eq("user_id", userId)
					.not("description", "is", null)
					.order("created_at", { ascending: false })
					.limit(100),
				db
					.from("transaction_presets")
					.select("description")
					.eq("user_id", userId)
					.not("description", "is", null)
					.limit(50),
				db.from("recurring_expenses").select("name").eq("user_id", userId).not("name", "is", null).limit(50),
			]);

			const set = new Set<string>();
			for (const row of allocRes.data ?? []) addDescription(set, row.name, true);
			for (const row of acctRes.data ?? []) addDescription(set, row.description, true);
			for (const row of presetRes.data ?? []) addDescription(set, row.description, false);
			for (const row of recRes.data ?? []) addDescription(set, row.name, false);
			return Array.from(set);
		},

		async getAccount(id) {
			const { data, error } = await db
				.from("accounts")
				.select("*, account_type:account_types(*)")
				.eq("id", id)
				.eq("user_id", userId)
				.maybeSingle();
			if (error) throw error;
			return (data as AccountWithType | null) ?? null;
		},

		async getBudgetRow(id) {
			const { data: row, error } = await db
				.from("transactions")
				.select("id, source, recurring_expense_id, linked_account_transaction_id")
				.eq("id", id)
				.eq("user_id", userId)
				.maybeSingle();
			if (error) throw error;
			if (!row) return null;

			const linkedId: string | null = row.linked_account_transaction_id;
			const filters = [
				linkedId ? `id.eq.${linkedId}` : null,
				row.source === "transfer" ? `linked_allocation_transaction_id.eq.${id}` : null,
			].filter((f): f is string => !!f);
			let legs: { accountId: string; amount: number }[] = [];
			if (filters.length > 0) {
				const { data: legRows, error: legError } = await db
					.from("account_transactions")
					.select("id, account_id, amount")
					.eq("user_id", userId)
					.or(filters.join(","));
				if (legError) throw legError;
				legs = (legRows ?? [])
					.filter((leg: { account_id: string | null }) => !!leg.account_id)
					.map((leg: { account_id: string; amount: number }) => ({
						accountId: leg.account_id,
						amount: Number(leg.amount),
					}));
			}

			return { id: row.id, source: row.source, recurringExpenseId: row.recurring_expense_id ?? null, legs };
		},

		async postEntries(budgetRow, legs) {
			const { data, error } = await db.rpc("post_ledger_entries", ledgerEntriesArgs(budgetRow, legs));
			if (error) throw error;
			return toPostedEntries(data);
		},

		async updateBudgetRow(id, patch) {
			const { error } = await db.from("transactions").update(patch).eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async deleteBudgetRow(id) {
			const { error } = await db.from("transactions").delete().eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async getLedgerRow(id) {
			const { data, error } = await db
				.from("account_transactions")
				.select("id, account_id, amount, transaction_type, linked_allocation_transaction_id")
				.eq("id", id)
				.eq("user_id", userId)
				.maybeSingle();
			if (error) throw error;
			return data ? { ...data, amount: Number(data.amount) } : null;
		},

		async updateLedgerRow(id, patch) {
			const { error } = await db.from("account_transactions").update(patch).eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async deleteLedgerRow(id) {
			const { error } = await db.from("account_transactions").delete().eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async setBalance(accountId, balance) {
			const { error } = await db.from("accounts").update({ current_balance: balance }).eq("id", accountId);
			if (error) throw error;
		},

		async updateUnified(id, input) {
			const { data, error } = await db.rpc("update_unified_transaction", { p_transaction_id: id, p_input: input });
			if (error) throw error;
			return data === true;
		},

		async deleteUnified(id) {
			const { data, error } = await db.rpc("delete_unified_transaction", { p_transaction_id: id });
			if (error) throw error;
			return data === true;
		},
	};
}

/**
 * Demo transactions are recorded in the browser's demo store, so this side keeps no rows: new rows
 * are accepted and dropped, and saved rows are never found here.
 */
function demoTransactionStore(_ctx: DemoContext): TransactionStore {
	let nextId = 0;
	const demoId = (prefix: string) => `${prefix}-${Date.now()}-${nextId++}`;

	return {
		async listSelectableAccounts() {
			return sampleAccounts;
		},
		async listUsedDescriptions() {
			return [];
		},
		async getAccount(id) {
			return sampleAccounts.find((account) => account.id === id) ?? null;
		},
		async getBudgetRow() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async postEntries(budgetRow, legs) {
			return {
				budgetRowId: budgetRow ? demoId("demo-budget") : null,
				legIds: legs.map(() => demoId("demo-ledger")),
			};
		},
		async updateBudgetRow() {},
		async deleteBudgetRow() {},
		async getLedgerRow() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async updateLedgerRow() {},
		async deleteLedgerRow() {},
		async setBalance() {},
		async updateUnified() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async deleteUnified() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
	};
}
