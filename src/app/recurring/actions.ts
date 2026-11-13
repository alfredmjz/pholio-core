"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { allocationStore } from "@/app/allocations/allocation-store";
import { settingsStore } from "@/app/settings/settings-store";
import { ActionError } from "@/lib/action-result";
import { idSchema, moneySchema } from "@/lib/action-schemas";
import { getReadContext, type DataContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import type { Json } from "@/lib/database.types";
import { Logger } from "@/lib/logger";
import { formatFullDate, getTodayDateString } from "@/lib/date-utils";
import { compareAlphabetically } from "@/lib/sort-utils";
import { earlyPaymentPlan, PAY_AHEAD_MAX } from "./recurring-schedule";
import { isRecurringTransfer } from "./recurring-occurrence";
import { listRecurringExpenses, recurringStore } from "./recurring-store";
import type { RecurringExpense } from "./recurring-types";

export type { NewRecurringExpense, RecurringExpense, RecurringExpenseStatus } from "./recurring-types";

const TRANSFER_ACCOUNTS_MESSAGE = "Check that both accounts are still open and try again.";

const recurringFieldsSchema = z.object({
	name: z.string().trim().min(1, "Give it a name."),
	amount: moneySchema.positive("Amount must be greater than zero."),
	currency: z.string().nullish(),
	billing_period: z.string().min(1, "Choose how often it repeats."),
	next_due_date: z.string().min(1, "Choose the next due date."),
	category: z.string().min(1, "Choose a type."),
	budget_category: z.string().nullish(),
	account_id: z.string().nullish(),
	to_account_id: z.string().nullish(),
	is_active: z.boolean().nullish(),
	service_provider: z.string().nullish(),
	meta_data: z.custom<Json>().nullish(),
});

const newRecurringSchema = recurringFieldsSchema;
const recurringUpdateSchema = recurringFieldsSchema.partial();
const payCountSchema = z
	.number()
	.int("Choose a whole number of bills.")
	.min(1, "Choose at least one bill.")
	.max(PAY_AHEAD_MAX, `You can pay at most ${PAY_AHEAD_MAX} bills at once.`);
const payOptionsSchema = z.object({ early: z.boolean().optional() }).default({});

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
	const ctx = await getReadContext();
	if (!ctx) return [];

	return listRecurringExpenses(ctx);
}

/**
 * A transfer moves money between two of the user's accounts: it has no budget category or service.
 * Bills and subscriptions have no destination account.
 */
function normalizeRecurringKind<T extends { category?: string }>(row: T): T {
	if (row.category === undefined) return row;
	return isRecurringTransfer({ category: row.category })
		? { ...row, budget_category: null, service_provider: null }
		: { ...row, to_account_id: null };
}

async function syncAllocationForCurrentMonth(ctx: DataContext, delayMs: number = 0) {
	if (delayMs > 0) {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;

	try {
		const allocations = allocationStore(ctx);
		const existing = await allocations.find(year, month);
		if (!existing) {
			await allocations.findOrCreateWithDefaults(year, month);
		}
	} catch (syncError) {
		Logger.warn("Failed to auto-sync allocation", { error: syncError });
	}
}

function revalidateRecurring() {
	revalidatePath("/recurring");
	revalidatePath("/allocations");
}

export const addRecurringExpense = defineAction("addRecurringExpense", [newRecurringSchema], async (ctx, expense) => {
	const store = recurringStore(ctx);
	const row = normalizeRecurringKind(expense);
	if (isRecurringTransfer(row) && !(await store.transferAccountsAreUsable(row))) {
		throw new ActionError("invalid_input", TRANSFER_ACCOUNTS_MESSAGE);
	}

	const created = await store.insert(row);
	await syncAllocationForCurrentMonth(ctx);
	revalidateRecurring();
	return created;
});

export const toggleSubscription = defineAction(
	"toggleSubscription",
	[idSchema, z.boolean()],
	async (ctx, id, isActive) => {
		await recurringStore(ctx).update(id, { is_active: isActive });
		await syncAllocationForCurrentMonth(ctx);
		revalidateRecurring();
	}
);

export const updateRecurringExpense = defineAction(
	"updateRecurringExpense",
	[idSchema, recurringUpdateSchema],
	async (ctx, id, updates) => {
		const store = recurringStore(ctx);

		let row: Partial<RecurringExpense> = updates;
		if (updates.category !== undefined || updates.account_id !== undefined || updates.to_account_id !== undefined) {
			const current = await store.findKind(id);
			if (!current) throw new ActionError("not_found", "That item no longer exists.");
			const merged = { ...current, ...updates };
			row = normalizeRecurringKind({ ...updates, category: merged.category });
			if (isRecurringTransfer(merged) && !(await store.transferAccountsAreUsable({ ...merged, ...row }))) {
				throw new ActionError("invalid_input", TRANSFER_ACCOUNTS_MESSAGE);
			}
		}

		await store.update(id, row);
		await syncAllocationForCurrentMonth(ctx);
		revalidateRecurring();
	}
);

export const deleteRecurringExpense = defineAction("deleteRecurringExpense", [idSchema], async (ctx, id) => {
	await recurringStore(ctx).remove(id);
	await syncAllocationForCurrentMonth(ctx, 500);
	revalidateRecurring();
});

/**
 * Current month's allocation category names, used to populate the recurring
 * "Budget category" picker. The auto-managed "Bills"/"Subscriptions" buckets are
 * excluded because the "Default" option already targets them. Sorted
 * alphabetically (ADR-003).
 */
export async function getRecurringCategoryOptions(): Promise<string[]> {
	const ctx = await getReadContext();
	if (!ctx) return [];

	const now = new Date();
	const names = await recurringStore(ctx).categoryNames(now.getFullYear(), now.getMonth() + 1);
	// The "Default" picker option already resolves to these buckets.
	const hidden = new Set(["bills", "subscriptions"]);
	return Array.from(new Set(names))
		.filter((name) => !hidden.has(name.toLowerCase()))
		.sort((a, b) => compareAlphabetically(a, b));
}

export const markAsPaid = defineAction("markAsPaid", [idSchema], async (ctx, expenseId) => {
	await payOccurrences(ctx, expenseId, 1, {});
});

/**
 * Records `count` bills from the next due date and moves the due date past them. A bill paid when
 * due is recorded on its due date. Paying early records each bill today, the day the money leaves,
 * so it lands in this month's budget, with the due date it covers in its note.
 */
export const payRecurringExpense = defineAction(
	"payRecurringExpense",
	[idSchema, payCountSchema, payOptionsSchema],
	async (ctx, expenseId, count, options) => {
		await payOccurrences(ctx, expenseId, count, options);
	}
);

async function payOccurrences(ctx: DataContext, expenseId: string, count: number, options: { early?: boolean }) {
	const store = recurringStore(ctx);
	const expense = await store.find(expenseId);
	if (!expense) throw new ActionError("not_found", "That item no longer exists.");

	if (isRecurringTransfer(expense) && !(await store.transferAccountsAreUsable(expense))) {
		throw new ActionError("invalid_input", TRANSFER_ACCOUNTS_MESSAGE);
	}

	const { covered, nextDue } = earlyPaymentPlan(expense.next_due_date, expense.billing_period, count);
	const today = options.early ? getTodayDateString((await settingsStore(ctx).getTimezone()) ?? undefined) : null;

	for (const dueDate of covered) {
		await store.recordOccurrence(expense, {
			transactionDate: today ?? dueDate,
			coversDueDate: dueDate,
			notes: today ? `Paid early for the ${formatFullDate(dueDate)} bill` : `Manual payment for ${expense.name}`,
		});
	}

	await store.setNextDueDate(expenseId, nextDue);
	revalidateRecurring();
}
