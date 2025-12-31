"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";
import { MOCK_RECURRING_EXPENSES } from "@/mock-data/recurring";
import { MOCK_TRANSACTIONS } from "@/mock-data/transactions";
import { Logger } from "@/lib/logger";

export type RecurringExpenseStatus = "paid" | "partial" | "unpaid" | "overpaid" | "upcoming" | "overdue";

export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"] & {
	status?: RecurringExpenseStatus;
	paid_amount?: number;
};
export type NewRecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Insert"];

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
	const supabase = await createClient();

	// [NEW] Logic to check payment status
	// 1. Get current month range
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

	let expenses: RecurringExpense[] = [];
	let transactions: any[] = [];

	// [Step 1: Data Retrieval]
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		// Use Mock Data
		expenses = MOCK_RECURRING_EXPENSES;
		transactions = MOCK_TRANSACTIONS;
	} else {
		// Use Supabase Data
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

		// Optimization: In a real app we might want to filter but for personal finance scale all month txns is fine
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

		// Check if past due
		const dueDate = new Date(expense.next_due_date);
		const isPastDue = new Date() > dueDate;

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

		// Determine Status
		if (paidAmount >= Number(expense.amount)) {
			status = "paid";
		} else if (paidAmount > 0) {
			status = "partial";
		} else if (isPastDue) {
			status = "overdue";
		} else {
			status = "upcoming";
		}

		return {
			...expense,
			status,
			paid_amount: paidAmount,
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

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return data;
}

/**
 * Toggle subscription active status
 */
export async function toggleSubscription(id: string, isActive: boolean): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase.from("recurring_expenses").update({ is_active: isActive }).eq("id", id);

	if (error) {
		Logger.error("Error toggling subscription", { error });
		return false;
	}

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

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return true;
}

/**
 * Delete a recurring expense
 */
export async function deleteRecurringExpense(id: string): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);

	if (error) {
		Logger.error("Error deleting recurring expense", { error });
		return false;
	}

	revalidatePath("/recurring");
	revalidatePath("/allocations");
	return true;
}
