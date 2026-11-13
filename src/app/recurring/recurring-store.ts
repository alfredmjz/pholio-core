import { ActionError, DEMO_READONLY_ERROR } from "@/lib/action-result";
import type { DataContext, DemoContext, SupabaseContext } from "@/lib/data-context.server";
import type { Json } from "@/lib/database.types";
import { Logger } from "@/lib/logger";
import { formatDateString, parseLocalDate } from "@/lib/date-utils";
import { sampleAllocationSummary } from "@/mock-data/allocations";
import { getMockRecurringExpenses } from "@/mock-data/recurring";
import { getMockTransactions } from "@/mock-data/transactions";
import { canPostTransfer, isRecurringTransfer, recurringOccurrenceRow } from "./recurring-occurrence";
import { enrichRecurringExpenses, type MonthPayment, type RecordedOccurrence } from "./recurring-status";
import type { NewRecurringExpense, RecurringExpense } from "./recurring-types";

export interface RecurringMonthData {
	expenses: RecurringExpense[];
	/** Payments made this month, plus bills due this month that were paid early. */
	payments: MonthPayment[];
	/** Occurrences already recorded, so a deleted auto-payment shows as unpaid without being re-recorded. */
	recorded: RecordedOccurrence[];
}

export type RecurringRow = Omit<NewRecurringExpense, "user_id" | "id" | "created_at" | "updated_at">;

export interface RecurringKindFields {
	category: string;
	account_id: string | null;
	to_account_id: string | null;
}

export interface OccurrenceInput {
	transactionDate: string;
	coversDueDate: string;
	notes: string;
}

export interface RecurringStore {
	/** This month's items, payments and recorded occurrences, around `now`. */
	loadMonth(now: Date): Promise<RecurringMonthData>;
	find(id: string): Promise<RecurringExpense | null>;
	/** The fields that decide whether an item is a transfer, or null when no such item exists. */
	findKind(id: string): Promise<RecurringKindFields | null>;
	/** A transfer posts only between two different accounts that are both still active. */
	transferAccountsAreUsable(row: { account_id?: string | null; to_account_id?: string | null }): Promise<boolean>;
	insert(row: RecurringRow): Promise<RecurringExpense>;
	update(id: string, row: Partial<RecurringExpense>): Promise<void>;
	remove(id: string): Promise<void>;
	/** Names of the current month's budget categories, for the "Budget category" picker. */
	categoryNames(year: number, month: number): Promise<string[]>;
	/** Posts one bill, subscription or transfer into the budget, in the category of that month. */
	recordOccurrence(expense: RecurringExpense, occurrence: OccurrenceInput): Promise<void>;
	setNextDueDate(id: string, nextDueDate: string): Promise<void>;
}

export function recurringStore(ctx: DataContext): RecurringStore {
	return ctx.kind === "demo" ? demoRecurringStore(ctx) : supabaseRecurringStore(ctx);
}

/** This month's recurring items with their paid status, as the Recurring page, Dashboard and weather show them. */
export async function listRecurringExpenses(ctx: DataContext, now: Date = new Date()): Promise<RecurringExpense[]> {
	const { expenses, payments, recorded } = await recurringStore(ctx).loadMonth(now);
	return enrichRecurringExpenses(expenses, payments, recorded, now);
}

/**
 * The allocation category NAME a recurring expense is bundled into. A user-chosen
 * `budget_category` wins; otherwise subscriptions fall back to "Subscriptions" and
 * bills to "Bills" (the legacy behavior).
 */
function resolveRecurringCategoryName(expense: { category: string; budget_category?: string | null }): string {
	const custom = expense.budget_category?.trim();
	if (custom) return custom;
	return expense.category === "bill" ? "Bills" : "Subscriptions";
}

function supabaseRecurringStore({ db, userId }: SupabaseContext): RecurringStore {
	const categoryIdFor = async (dateStr: string, categoryName: string): Promise<string | null> => {
		const date = parseLocalDate(dateStr);
		const { data: allocation } = await db
			.from("allocations")
			.select("id")
			.eq("user_id", userId)
			.eq("year", date.getFullYear())
			.eq("month", date.getMonth() + 1)
			.single();
		if (!allocation) return null;

		// Match by name, case-insensitively (category names are user-editable).
		const { data: categories } = await db
			.from("allocation_categories")
			.select("id, name")
			.eq("allocation_id", allocation.id);
		const match = (categories || []).find((c: { name: string }) => c.name.toLowerCase() === categoryName.toLowerCase());
		return match?.id || null;
	};

	return {
		async loadMonth(now) {
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			const monthStart = formatDateString(startOfMonth);
			const monthEnd = formatDateString(endOfMonth);

			const { data: dbExpenses, error } = await db
				.from("recurring_expenses")
				.select("*")
				.eq("user_id", userId)
				.order("next_due_date", { ascending: true });
			if (error) {
				Logger.error("Error fetching recurring expenses", { error });
				return { expenses: [], payments: [], recorded: [] };
			}

			const { data: dbPayments } = await db
				.from("transactions")
				.select("id, name, amount, transaction_date, recurring_expense_id, covers_due_date")
				.eq("user_id", userId)
				.or(
					`and(transaction_date.gte.${monthStart},transaction_date.lte.${monthEnd}),and(covers_due_date.gte.${monthStart},covers_due_date.lte.${monthEnd})`
				);

			const { data: dbRecorded } = await db
				.from("recurring_recorded_occurrences")
				.select("recurring_expense_id, occurrence_date, amount")
				.eq("user_id", userId)
				.gte("occurrence_date", startOfMonth.toISOString())
				.lte("occurrence_date", endOfMonth.toISOString());

			return { expenses: dbExpenses || [], payments: dbPayments || [], recorded: dbRecorded || [] };
		},

		async find(id) {
			const { data, error } = await db
				.from("recurring_expenses")
				.select("*")
				.eq("id", id)
				.eq("user_id", userId)
				.single();
			if (error || !data) {
				Logger.error("Error fetching recurring expense", { error, id });
				return null;
			}
			return data;
		},

		async findKind(id) {
			const { data } = await db
				.from("recurring_expenses")
				.select("category, account_id, to_account_id")
				.eq("id", id)
				.eq("user_id", userId)
				.single();
			return data ?? null;
		},

		async transferAccountsAreUsable(row) {
			const ids = [row.account_id, row.to_account_id].filter((id): id is string => Boolean(id));
			if (ids.length !== 2) return false;
			const { data } = await db.from("accounts").select("id").in("id", ids).eq("user_id", userId).eq("is_active", true);
			return canPostTransfer(row, new Set((data ?? []).map((account: { id: string }) => account.id)));
		},

		async insert(row) {
			const { data, error } = await db
				.from("recurring_expenses")
				.insert({ ...row, meta_data: row.meta_data as Json, user_id: userId })
				.select()
				.single();
			if (error) throw error;
			return data;
		},

		async update(id, row) {
			const { error } = await db
				.from("recurring_expenses")
				.update(row as Record<string, unknown>)
				.eq("id", id)
				.eq("user_id", userId);
			if (error) throw error;
		},

		async remove(id) {
			// Payments already recorded stay: the transactions foreign key is ON DELETE SET NULL.
			const { error } = await db.from("recurring_expenses").delete().eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async categoryNames(year, month) {
			const { data: allocation } = await db
				.from("allocations")
				.select("id")
				.eq("user_id", userId)
				.eq("year", year)
				.eq("month", month)
				.single();
			if (!allocation) return [];

			const { data: categories } = await db
				.from("allocation_categories")
				.select("name")
				.eq("allocation_id", allocation.id);
			return (categories || []).map((c: { name: string }) => c.name);
		},

		async recordOccurrence(expense, { transactionDate, coversDueDate, notes }) {
			const categoryId = isRecurringTransfer(expense)
				? null
				: await categoryIdFor(transactionDate, resolveRecurringCategoryName(expense));

			const { error } = await db
				.from("transactions")
				.insert(recurringOccurrenceRow(expense, { userId, transactionDate, coversDueDate, categoryId, notes }));
			if (error) throw error;
		},

		async setNextDueDate(id, nextDueDate) {
			const { error } = await db
				.from("recurring_expenses")
				.update({ next_due_date: nextDueDate })
				.eq("id", id)
				.eq("user_id", userId);
			if (error) throw error;
		},
	};
}

/** The sample data is read-only: edits to existing items are accepted and dropped, new items and payments are refused. */
function demoRecurringStore(_ctx: DemoContext): RecurringStore {
	return {
		async loadMonth() {
			return { expenses: getMockRecurringExpenses(), payments: getMockTransactions(), recorded: [] };
		},
		async find() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async findKind() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async transferAccountsAreUsable() {
			return false;
		},
		async insert() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async update() {},
		async remove() {},
		async categoryNames() {
			return sampleAllocationSummary.categories.map((c) => c.name);
		},
		async recordOccurrence() {
			throw new ActionError("failed", DEMO_READONLY_ERROR);
		},
		async setNextDueDate() {},
	};
}
