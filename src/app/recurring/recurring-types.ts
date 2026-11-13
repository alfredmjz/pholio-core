import type { Database } from "@/lib/database.types";

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
