"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";
import { MOCK_RECURRING_EXPENSES } from "@/mock-data/recurring";
import { MOCK_TRANSACTIONS } from "@/mock-data/transactions";
import { Logger } from "@/lib/logger";
import { calculateNextDueDate } from "@/lib/date-utils";
import { getAllocation } from "../allocations/actions";

export type RecurringExpenseStatus = "paid" | "partial" | "unpaid" | "overpaid" | "upcoming" | "overdue" | "due_today";

export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"] & {
	status?: RecurringExpenseStatus;
	paid_amount?: number;
	paid_count?: number;
	occurrences_count?: number;
};
export type NewRecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Insert"];

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
	const supabase = await createClient();

	// Logic to check payment status
	// 1. Get current month range
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

	let expenses: RecurringExpense[] = [];
	let transactions: any[] = [];

	// [Step 1: Data Retrieval]
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
	}

	if (!expenses.length) return [];

	// [Step 2: Business Logic]
	const enrichedExpenses = expenses.map((expense) => {
		let status: RecurringExpenseStatus = "upcoming";
		let paidAmount = 0;

		const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time (server's local)
		const dueStr = expense.next_due_date.split("T")[0]; // YYYY-MM-DD
		const isPastDue = todayStr > dueStr;
		const isDueToday = todayStr === dueStr;

		if (transactions.length > 0) {
			// Priority 1: Manual Link via recurring_expense_id
			const manualMatches = transactions.filter((t) => t.recurring_expense_id === expense.id);

			if (manualMatches.length > 0) {
				paidAmount = manualMatches.reduce((sum, t) => sum + Math.abs(t.amount), 0);
			} else {
				// Priority 2: Auto Match via Name (Fallback)
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
		// 1. Paid Count (Transactions in current month)
		const paidTransactions = transactions.filter(
			(t) =>
				t.recurring_expense_id === expense.id ||
				(!t.recurring_expense_id &&
					(t.name.toLowerCase().includes(expense.name.toLowerCase()) ||
						expense.name.toLowerCase().includes(t.name.toLowerCase())))
		);
		const paidCount = paidTransactions.length;

		// Helper to normalize date string for comparison (YYYY-MM-DD)
		const toDateStr = (d: Date | string) => {
			if (typeof d === "string") return d.split("T")[0];
			return d.toISOString().split("T")[0];
		};

		// Set of dates already paid for this expense
		const paidDates = new Set(paidTransactions.map((t) => toDateStr(t.transaction_date)));

		// 2. Future Occurrences Count (Projected from next_due_date until end of month)
		let futureCount = 0;
		let tempDate = new Date(expense.next_due_date);
		// Parse strictly to avoid timezone issues for day comparison
		// We'll use the loop approach similar to syncRecurringExpenses but just counting
		const endOfMonthDate = new Date(endOfMonth);

		// If next due date is already past end of month, futureCount is 0
		// Otherwise, count how many fall within this month
		while (tempDate <= endOfMonthDate) {
			const tempDateStr = toDateStr(tempDate);

			// Only count if this specific date hasn't been paid yet
			if (!paidDates.has(tempDateStr)) {
				futureCount++;
			}

			tempDate = calculateNextDueDate(tempDate, expense.billing_period);
		}

		const totalOccurrences = paidCount + futureCount;

		// Determine Status
		if (paidAmount >= Number(expense.amount) && futureCount === 0) {
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

		// If effectively paid for this period (status is paid or due date matches a paid transaction),
		// project the DISPLAY date to the next period.
		// This fixes the issue where auto-pay bills show "Jan 6" even after being paid on Jan 6.
		let displayDueDate = expense.next_due_date;
		const nextDueStrictStr = toDateStr(expense.next_due_date);
		if (paidDates.has(nextDueStrictStr)) {
			// Current due date is paid, show the next one
			displayDueDate = calculateNextDueDate(new Date(expense.next_due_date), expense.billing_period).toISOString();
		}

		return {
			...expense,
			next_due_date: displayDueDate, // Override purely for display
			status,
			paid_amount: paidAmount,
			paid_count: paidCount,
			occurrences_count: totalOccurrences,
		};
	});

	return enrichedExpenses;
}

/**
 * Add a new recurring expense
 */
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

	// Trigger sync of allocations to update budget caps and create transactions for automated items
	// Trigger sync of allocations to update budget caps and create transactions for automated items
	await syncAllocationForCurrentMonth();

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return data;
}

/**
 * Toggle subscription active status
 */
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

/**
 * Update a recurring expense
 */
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

/**
 * Delete a recurring expense and its associated transactions
 */
export async function deleteRecurringExpense(id: string): Promise<boolean> {
	const supabase = await createClient();

	// First, delete all transactions linked to this recurring expense
	const { error: txError } = await supabase.from("transactions").delete().eq("recurring_expense_id", id);

	if (txError) {
		Logger.error("Error deleting linked transactions", { error: txError });
		return false;
	}

	// Then delete the recurring expense itself
	const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);

	if (error) {
		Logger.error("Error deleting recurring expense", { error });
		return false;
	}

	// Trigger sync of allocations to update budget caps
	// We sync the current month. Future months will sync when visited.
	// Small delay to ensure DB propagation of deletions
	// Trigger sync of allocations to update budget caps
	// We sync the current month. Future months will sync when visited.
	// Small delay to ensure DB propagation of deletions
	await syncAllocationForCurrentMonth(500);

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return true;
}

/**
 * Helper to get the allocation category ID for a transaction date and type
 */
async function getCategoryIdForExpense(
	supabase: any,
	userId: string,
	dateStr: string,
	type: "bill" | "subscription"
): Promise<string | null> {
	const date = new Date(dateStr);
	const year = date.getFullYear();
	const month = date.getMonth() + 1;

	// 1. Find allocation for this month
	const { data: allocation } = await supabase
		.from("allocations")
		.select("id")
		.eq("user_id", userId)
		.eq("year", year)
		.eq("month", month)
		.single();

	if (!allocation) return null;

	// 2. Find matching category
	const catName = type === "bill" ? "Bills" : "Subscriptions";
	const { data: category } = await supabase
		.from("allocation_categories")
		.select("id")
		.eq("allocation_id", allocation.id)
		.eq("name", catName)
		.single();

	return category?.id || null;
}

/**
 * Mark a manual recurring expense as paid
 * - Creates a transaction
 * - Updates next_due_date
 */
/**
 * Mark a manual recurring expense as paid
 * - Creates a transaction
 * - Updates next_due_date
 */
export async function markAsPaid(expenseId: string): Promise<boolean> {
	// Re-use logic from payRecurringExpense
	return payRecurringExpense(expenseId, 1);
}

/**
 * Pay multiple future instances of a recurring expense
 */
export async function payRecurringExpense(expenseId: string, count: number): Promise<boolean> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user || count < 1) return false;

	// 1. Get the expense
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

	// 2. Create Transactions in loop
	for (let i = 0; i < count; i++) {
		const success = await createRecurringTransaction(
			supabase,
			user.id,
			expense,
			currentDueDate,
			count > 1 ? `Future payment (${i + 1}/${count})` : "Manual payment"
		);

		if (!success) {
			// Stop if a tx fails to avoid desync state
			return false;
		}

		// Advance date for next iteration
		currentDueDate = calculateNextDueDate(currentDueDate, expense.billing_period);
	}

	// 3. Update next_due_date to the final calculated date
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

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Helper to sync allocations for the current month.
 * Swallows errors but logs them, as sync failure shouldn't block the main action.
 */
async function syncAllocationForCurrentMonth(delayMs: number = 0) {
	if (delayMs > 0) {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	const now = new Date();
	try {
		await getAllocation(now.getFullYear(), now.getMonth() + 1);
	} catch (syncError) {
		Logger.warn("Failed to auto-sync allocation", { error: syncError });
	}
}

/**
 * Helper to create a transaction linked to a recurring expense.
 */
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
		expense.category as "bill" | "subscription"
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
