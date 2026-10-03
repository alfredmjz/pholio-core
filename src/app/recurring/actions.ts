"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";
import { MOCK_RECURRING_EXPENSES } from "@/mock-data/recurring";
import { MOCK_TRANSACTIONS } from "@/mock-data/transactions";
import { Logger } from "@/lib/logger";
import { calculateNextDueDate, formatDateString, parseLocalDate } from "@/lib/date-utils";
import { compareAlphabetically } from "@/lib/sort-utils";
import { sampleAllocationSummary } from "@/mock-data/allocations";
import { getAllocation, autoCreateAllocationWithDefaults } from "../allocations/actions";

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

export type RecurringExpenseStatus = "paid" | "partial" | "unpaid" | "overpaid" | "upcoming" | "overdue" | "due_today";

export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"] & {
	status?: RecurringExpenseStatus;
	paid_amount?: number;
	paid_count?: number;
	occurrences_count?: number;
	deleted_auto_payments?: number;
	next_amount_change?: { from: number; to: number };
	next_due_change?: { from: string; to: string };
};
export type NewRecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Insert"];

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
	const supabase = await createClient();

	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

	let expenses: RecurringExpense[] = [];
	let transactions: any[] = [];
	let recordedOccurrences: any[] = [];

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		expenses = MOCK_RECURRING_EXPENSES;
		transactions = MOCK_TRANSACTIONS;
	} else {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return [];

		const { data: dbExpenses, error: expensesError } = await supabase
			.from("recurring_expenses")
			.select("*")
			.eq("user_id", user.id)
			.order("next_due_date", { ascending: true });

		if (expensesError) {
			Logger.error("Error fetching recurring expenses", { error: expensesError });
			return [];
		}
		expenses = dbExpenses || [];

		const { data: dbTransactions } = await supabase
			.from("transactions")
			.select("id, name, amount, transaction_date, recurring_expense_id")
			.eq("user_id", user.id)
			.gte("transaction_date", startOfMonth)
			.lte("transaction_date", endOfMonth);

		transactions = dbTransactions || [];

		// Recorded occurrences let us show an occurrence as "not paid" after its
		// auto-created transaction is deleted, without auto-pay re-recording it.
		const { data: dbRecorded } = await supabase
			.from("recurring_recorded_occurrences")
			.select("recurring_expense_id, occurrence_date, amount")
			.eq("user_id", user.id)
			.gte("occurrence_date", startOfMonth)
			.lte("occurrence_date", endOfMonth);

		recordedOccurrences = dbRecorded || [];
	}

	if (!expenses.length) return [];

	const enrichedExpenses = expenses.map((expense) => {
		let status: RecurringExpenseStatus = "upcoming";
		let paidAmount = 0;

		const todayStr = new Date().toLocaleDateString("en-CA");
		const dueStr = expense.next_due_date.split("T")[0];
		const isPastDue = todayStr > dueStr;
		const isDueToday = todayStr === dueStr;

		if (transactions.length > 0) {
			const manualMatches = transactions.filter((t) => t.recurring_expense_id === expense.id);

			if (manualMatches.length > 0) {
				paidAmount = manualMatches.reduce((sum, t) => sum + Math.abs(t.amount), 0);
			} else {
				const autoMatches = transactions.filter(
					(t) =>
						// Ensure not linked to another expense
						!t.recurring_expense_id &&
						(t.name.toLowerCase().includes(expense.name.toLowerCase()) ||
							expense.name.toLowerCase().includes(t.name.toLowerCase()))
				);
				paidAmount = autoMatches.reduce((sum, t) => sum + Math.abs(t.amount), 0);
			}
		}

		// Calculate Counts

		const paidTransactions = transactions.filter(
			(t) =>
				t.recurring_expense_id === expense.id ||
				(!t.recurring_expense_id &&
					(t.name.toLowerCase().includes(expense.name.toLowerCase()) ||
						expense.name.toLowerCase().includes(t.name.toLowerCase())))
		);
		const paidCount = paidTransactions.length;

		const toDateStr = (d: Date | string) => {
			if (typeof d === "string") return d.split("T")[0];
			return d.toISOString().split("T")[0];
		};

		// Set of dates already paid for this expense
		const paidDates = new Set(paidTransactions.map((t) => toDateStr(t.transaction_date)));

		// Recorded occurrences for this expense in the current month. An occurrence
		// whose transaction was deleted still counts as an occurrence (0 of 1 paid).
		const monthMarkers = recordedOccurrences.filter((m) => m.recurring_expense_id === expense.id);
		const markerDates = new Set(monthMarkers.map((m) => toDateStr(m.occurrence_date)));
		const deletedAutoPaymentCount = monthMarkers.filter((m) => !paidDates.has(toDateStr(m.occurrence_date))).length;

		let futureCount = 0;
		let tempDate = new Date(expense.next_due_date);

		const endOfMonthDate = new Date(endOfMonth);

		// If next due date is already past end of month, futureCount is 0
		// Otherwise, count how many fall within this month
		while (tempDate <= endOfMonthDate) {
			const tempDateStr = toDateStr(tempDate);

			// Only count if this specific date hasn't been paid or recorded yet
			if (!paidDates.has(tempDateStr) && !markerDates.has(tempDateStr)) {
				futureCount++;
			}

			tempDate = calculateNextDueDate(tempDate, expense.billing_period);
		}

		const totalOccurrences = paidCount + futureCount + deletedAutoPaymentCount;

		// Compare against the amount captured when the occurrence was recorded so an
		// edit to next month's amount doesn't turn a paid month into "partial".
		const recordedExpectedAmount = monthMarkers.reduce((sum, m) => sum + Math.abs(Number(m.amount)), 0);
		const expectedAmount = recordedExpectedAmount > 0 ? recordedExpectedAmount : Number(expense.amount);

		if (paidAmount > 0 && paidAmount >= expectedAmount && futureCount === 0) {
			status = "paid";
		} else if (paidAmount > 0) {
			status = "partial";
		} else if (isPastDue) {
			status = "overdue";
		} else if (isDueToday) {
			status = "due_today";
		} else {
			status = "upcoming";
		}

		let displayDueDate = expense.next_due_date;
		const nextDueStrictStr = toDateStr(expense.next_due_date);
		if (paidDates.has(nextDueStrictStr)) {
			displayDueDate = calculateNextDueDate(new Date(expense.next_due_date), expense.billing_period).toISOString();
		}

		// Detect changes scheduled for the next cycle so the card can distinguish the
		// upcoming amount/date from what was actually paid this cycle.
		let nextAmountChange: RecurringExpense["next_amount_change"];
		let nextDueChange: RecurringExpense["next_due_change"];

		if (monthMarkers.length > 0) {
			const latestMarker = [...monthMarkers].sort((a, b) =>
				toDateStr(b.occurrence_date).localeCompare(toDateStr(a.occurrence_date))
			)[0];
			const latestDateStr = toDateStr(latestMarker.occurrence_date);
			const recordedAmount = Math.abs(Number(latestMarker.amount));
			const currentAmount = Number(expense.amount);

			if (recordedAmount !== currentAmount) {
				nextAmountChange = { from: recordedAmount, to: currentAmount };
			}

			const naturalNextDue = formatDateString(
				calculateNextDueDate(parseLocalDate(latestDateStr), expense.billing_period)
			);
			const actualNextDue = displayDueDate ? displayDueDate.split("T")[0] : toDateStr(expense.next_due_date);
			if (naturalNextDue !== actualNextDue) {
				nextDueChange = { from: naturalNextDue, to: actualNextDue };
			}
		}

		return {
			...expense,
			next_due_date: displayDueDate,
			status,
			paid_amount: paidAmount,
			paid_count: paidCount,
			occurrences_count: totalOccurrences,
			deleted_auto_payments: deletedAutoPaymentCount,
			next_amount_change: nextAmountChange,
			next_due_change: nextDueChange,
		};
	});

	return enrichedExpenses;
}

export async function addRecurringExpense(
	expense: Omit<NewRecurringExpense, "user_id" | "id" | "created_at" | "updated_at">
): Promise<RecurringExpense | null> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const { data, error } = await supabase
		.from("recurring_expenses")
		.insert({
			...expense,
			user_id: user.id,
		})
		.select()
		.single();

	if (error) {
		Logger.error("Error adding recurring expense", { error });
		return null;
	}

	await syncAllocationForCurrentMonth();

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return data;
}

export async function toggleSubscription(id: string, isActive: boolean): Promise<boolean> {
	const supabase = await createClient();

	const updates: Record<string, any> = { is_active: isActive };

	const { error } = await supabase.from("recurring_expenses").update(updates).eq("id", id);

	if (error) {
		Logger.error("Error toggling subscription", { error });
		return false;
	}

	// Trigger sync of allocations
	await syncAllocationForCurrentMonth();

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return true;
}

export async function updateRecurringExpense(id: string, updates: Partial<RecurringExpense>): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase.from("recurring_expenses").update(updates).eq("id", id);

	if (error) {
		Logger.error("Error updating recurring expense", { error });
		return false;
	}

	// Trigger sync of allocations
	await syncAllocationForCurrentMonth();

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return true;
}

export async function deleteRecurringExpense(id: string): Promise<boolean> {
	const supabase = await createClient();

	// Delete the recurring expense itself.
	// Previously recorded transactions are preserved because of ON DELETE SET NULL constraint.
	const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);

	if (error) {
		Logger.error("Error deleting recurring expense", { error });
		return false;
	}

	await syncAllocationForCurrentMonth(500);

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return true;
}

async function getCategoryIdForExpense(
	supabase: any,
	userId: string,
	dateStr: string,
	categoryName: string
): Promise<string | null> {
	const date = new Date(dateStr);
	const year = date.getFullYear();
	const month = date.getMonth() + 1;

	const { data: allocation } = await supabase
		.from("allocations")
		.select("id")
		.eq("user_id", userId)
		.eq("year", year)
		.eq("month", month)
		.single();

	if (!allocation) return null;

	// Match by name, case-insensitively (category names are user-editable).
	const { data: categories } = await supabase
		.from("allocation_categories")
		.select("id, name")
		.eq("allocation_id", allocation.id);

	const match = (categories || []).find(
		(c: { name: string }) => c.name.toLowerCase() === categoryName.toLowerCase()
	);

	return match?.id || null;
}

/**
 * Current month's allocation category names, used to populate the recurring
 * "Budget category" picker. The auto-managed "Bills"/"Subscriptions" buckets are
 * excluded because the "Default" option already targets them. Sorted
 * alphabetically (ADR-003).
 */
export async function getRecurringCategoryOptions(): Promise<string[]> {
	// The "Default" picker option already resolves to these buckets.
	const hidden = new Set(["bills", "subscriptions"]);
	const clean = (names: string[]) =>
		Array.from(new Set(names))
			.filter((name) => !hidden.has(name.toLowerCase()))
			.sort((a, b) => compareAlphabetically(a, b));

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return clean(sampleAllocationSummary.categories.map((c) => c.name));
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return [];

	const now = new Date();
	const { data: allocation } = await supabase
		.from("allocations")
		.select("id")
		.eq("user_id", user.id)
		.eq("year", now.getFullYear())
		.eq("month", now.getMonth() + 1)
		.single();

	if (!allocation) return [];

	const { data: categories } = await supabase
		.from("allocation_categories")
		.select("name")
		.eq("allocation_id", allocation.id);

	return clean((categories || []).map((c: { name: string }) => c.name));
}

export async function markAsPaid(expenseId: string): Promise<boolean> {
	return payRecurringExpense(expenseId, 1);
}

export async function payRecurringExpense(expenseId: string, count: number): Promise<boolean> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user || count < 1) return false;

	const { data: expense, error: fetchError } = await supabase
		.from("recurring_expenses")
		.select("*")
		.eq("id", expenseId)
		.single();

	if (fetchError || !expense) {
		Logger.error("Error fetching expense for payRecurringExpense", { error: fetchError });
		return false;
	}

	let currentDueDate = new Date(expense.next_due_date);

	for (let i = 0; i < count; i++) {
		const success = await createRecurringTransaction(
			supabase,
			user.id,
			expense,
			currentDueDate,
			count > 1 ? `Future payment (${i + 1}/${count})` : "Manual payment"
		);

		if (!success) {
			return false;
		}

		// Advance date for next iteration
		currentDueDate = calculateNextDueDate(currentDueDate, expense.billing_period);
	}

	const { error: updateError } = await supabase
		.from("recurring_expenses")
		.update({ next_due_date: currentDueDate.toISOString() })
		.eq("id", expenseId);

	if (updateError) {
		Logger.error("Error updating next due date", { error: updateError });
		return false;
	}

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return true;
}

async function syncAllocationForCurrentMonth(delayMs: number = 0) {
	if (delayMs > 0) {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	
	try {
		const existing = await getAllocation(year, month);
		if (!existing) {
			await autoCreateAllocationWithDefaults(year, month);
		}
	} catch (syncError) {
		Logger.warn("Failed to auto-sync allocation", { error: syncError });
	}
}

async function createRecurringTransaction(
	supabase: any,
	userId: string,
	expense: RecurringExpense,
	date: Date,
	notePrefix: string = "Payment"
): Promise<boolean> {
	const dueDateStr = date.toISOString().split("T")[0];

	// Attempt to link category
	const categoryId = await getCategoryIdForExpense(
		supabase,
		userId,
		dueDateStr,
		resolveRecurringCategoryName(expense)
	);

	const { error: txError } = await supabase.from("transactions").insert({
		user_id: userId,
		name: expense.name,
		amount: -Math.abs(Number(expense.amount)),
		transaction_date: dueDateStr,
		category_id: categoryId,
		source: "recurring",
		recurring_expense_id: expense.id,
		notes: `${notePrefix} for ${expense.name}`,
	});

	if (txError) {
		Logger.error(`Error creating transaction for ${expense.name}`, { error: txError });
		return false;
	}

	return true;
}
