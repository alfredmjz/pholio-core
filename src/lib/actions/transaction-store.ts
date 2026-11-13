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

export interface NewLedgerRow {
	accountId: string;
	amount: number;
	transactionType: string;
	description: string;
	date: string;
	linkedBudgetRowId: string | null;
	isCashAdvance?: boolean;
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
	insertBudgetRow(row: NewBudgetRow): Promise<string>;
	updateBudgetRow(id: string, patch: BudgetRowPatch): Promise<void>;
	linkBudgetRow(budgetRowId: string, ledgerRowId: string): Promise<void>;
	deleteBudgetRow(id: string): Promise<void>;
	getLedgerRow(id: string): Promise<LedgerRow | null>;
	insertLedgerRow(row: NewLedgerRow): Promise<string>;
	updateLedgerRow(id: string, patch: LedgerRowPatch): Promise<void>;
	linkTransferLegs(fromLedgerRowId: string, toLedgerRowId: string): Promise<void>;
	deleteLedgerRow(id: string): Promise<void>;
	adjustBalance(accountId: string, delta: number): Promise<void>;
	setBalance(accountId: string, balance: number): Promise<void>;
	/** update_unified_transaction(): false when the row is missing or the edit is rejected. */
	updateUnified(id: string, input: Record<string, unknown>): Promise<boolean>;
	/** delete_unified_transaction(): false when the row is missing. */
	deleteUnified(id: string): Promise<boolean>;
}

export function transactionStore(ctx: DataContext): TransactionStore {
	return ctx.kind === "demo" ? demoTransactionStore(ctx) : supabaseTransactionStore(ctx);
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

		async insertBudgetRow(row) {
			const { data, error } = await db
				.from("transactions")
				.insert({
					user_id: userId,
					category_id: row.categoryId,
					name: row.name,
					amount: row.amount,
					transaction_date: row.date,
					notes: row.notes,
					source: row.source,
				})
				.select("id")
				.single();
			if (error || !data) throw error ?? new Error("Budget row insert returned nothing");
			return data.id;
		},

		async updateBudgetRow(id, patch) {
			const { error } = await db.from("transactions").update(patch).eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async linkBudgetRow(budgetRowId, ledgerRowId) {
			const { error } = await db
				.from("transactions")
				.update({ linked_account_transaction_id: ledgerRowId })
				.eq("id", budgetRowId)
				.eq("user_id", userId);
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

		async insertLedgerRow(row) {
			const { data, error } = await db
				.from("account_transactions")
				.insert({
					user_id: userId,
					account_id: row.accountId,
					amount: row.amount,
					transaction_type: row.transactionType,
					description: row.description,
					transaction_date: row.date,
					linked_allocation_transaction_id: row.linkedBudgetRowId,
					is_cash_advance: !!row.isCashAdvance,
				})
				.select("id")
				.single();
			if (error || !data) throw error ?? new Error("Ledger row insert returned nothing");
			return data.id;
		},

		async updateLedgerRow(id, patch) {
			const { error } = await db.from("account_transactions").update(patch).eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async linkTransferLegs(fromLedgerRowId, toLedgerRowId) {
			const [from, to] = await Promise.all([
				db
					.from("account_transactions")
					.update({ linked_transfer_transaction_id: toLedgerRowId })
					.eq("id", fromLedgerRowId),
				db
					.from("account_transactions")
					.update({ linked_transfer_transaction_id: fromLedgerRowId })
					.eq("id", toLedgerRowId),
			]);
			if (from.error || to.error) throw from.error ?? to.error;
		},

		async deleteLedgerRow(id) {
			const { error } = await db.from("account_transactions").delete().eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async adjustBalance(accountId, delta) {
			const { data, error } = await db.from("accounts").select("current_balance").eq("id", accountId).single();
			if (error || !data) throw error ?? new Error("Account not found");
			const { error: updateError } = await db
				.from("accounts")
				.update({ current_balance: Number(data.current_balance) + delta })
				.eq("id", accountId);
			if (updateError) throw updateError;
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
		async insertBudgetRow() {
			return demoId("demo-budget");
		},
		async updateBudgetRow() {},
		async linkBudgetRow() {},
		async deleteBudgetRow() {},
		async getLedgerRow() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async insertLedgerRow() {
			return demoId("demo-ledger");
		},
		async updateLedgerRow() {},
		async linkTransferLegs() {},
		async deleteLedgerRow() {},
		async adjustBalance() {},
		async setBalance() {},
		async updateUnified() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async deleteUnified() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
	};
}
