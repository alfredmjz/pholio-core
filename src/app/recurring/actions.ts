"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";
import { MOCK_RECURRING_EXPENSES } from "@/mock-data/recurring";

export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"];
export type NewRecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Insert"];

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
	const supabase = await createClient();

    // Check for mock data flag
    if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
        return MOCK_RECURRING_EXPENSES;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

	const { data, error } = await supabase
		.from("recurring_expenses")
		.select("*")
		.eq("user_id", user.id)
		.order("next_due_date", { ascending: true });

	if (error) {
		console.error("Error fetching recurring expenses:", error);
		// Only use mock data if explicitly requested
		if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
			return MOCK_RECURRING_EXPENSES;
		}
		return [];
	}

	return data || [];
}

/**
 * Add a new recurring expense
 */
export async function addRecurringExpense(expense: Omit<NewRecurringExpense, "user_id" | "id" | "created_at" | "updated_at">): Promise<RecurringExpense | null> {
	const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

	const { data, error } = await supabase
		.from("recurring_expenses")
		.insert({
			...expense,
			user_id: user.id
		})
		.select()
		.single();

	if (error) {
		console.error("Error adding recurring expense:", error);
		return null;
	}

	revalidatePath("/recurring");
    revalidatePath("/allocations")
	return data;
}

/**
 * Toggle subscription active status
 */
export async function toggleSubscription(id: string, isActive: boolean): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase
		.from("recurring_expenses")
		.update({ is_active: isActive })
		.eq("id", id);

	if (error) {
		console.error("Error toggling subscription:", error);
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

	const { error } = await supabase
		.from("recurring_expenses")
		.update(updates)
		.eq("id", id);

	if (error) {
		console.error("Error updating recurring expense:", error);
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

	const { error } = await supabase
		.from("recurring_expenses")
		.delete()
		.eq("id", id);

	if (error) {
		console.error("Error deleting recurring expense:", error);
		return false;
	}

	revalidatePath("/recurring");
    revalidatePath("/allocations");
	return true;
}
