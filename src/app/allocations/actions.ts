"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Allocation, AllocationCategory, AllocationSummary, AllocationTemplate, Transaction } from "./types";
import { sampleAllocationSummary, sampleTransactions } from "@/mock-data/allocations";
import { Logger } from "@/lib/logger";

/**
 * Check if allocation exists for a specific month (without creating)
 */
export async function getAllocation(year: number, month: number): Promise<Allocation | null> {
	// Handle sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		const now = new Date();
		if (year === now.getFullYear() && month === now.getMonth() + 1) {
			return sampleAllocationSummary.allocation;
		}
		return null;
	}

	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const { data: existing } = await supabase
		.from("allocations")
		.select("*")
		.eq("user_id", user.id)
		.eq("year", year)
		.eq("month", month)
		.single();

	return existing as Allocation | null;
}

/**
 * Get or create allocation for a specific month
 */
export async function getOrCreateAllocation(
	year: number,
	month: number,
	expectedIncome: number = 0
): Promise<Allocation | null> {
	// Handle sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return sampleAllocationSummary.allocation;
	}

	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	// Try to get existing allocation
	const { data: existing, error: fetchError } = await supabase
		.from("allocations")
		.select("*")
		.eq("user_id", user.id)
		.eq("year", year)
		.eq("month", month)
		.single();

	if (existing) {
		await syncRecurringExpenses(existing.id, user.id, month);
		return existing as Allocation;
	}

	// Create new allocation if it doesn't exist
	const { data: newAllocation, error: createError } = await supabase
		.from("allocations")
		.insert({
			user_id: user.id,
			year,
			month,
			expected_income: expectedIncome,
		})
		.select()
		.single();

	if (createError) {
		Logger.error("Error creating allocation", { error: createError });
		return null;
	}

	// [NEW] Sync recurring expenses for the new allocation
	await syncRecurringExpenses(newAllocation.id, user.id, month);

	return newAllocation as Allocation;
}

/**
 * Helper to sync recurring expenses to a specific allocation category
 * This ensures that if the user adds a subscription mid-month, it's reflected.
 */
async function syncRecurringExpenses(allocationId: string, userId: string, targetMonth: number) {
	const supabase = await createClient();

	// 1. Fetch active recurring expenses
	const { data: recurring } = await supabase
		.from("recurring_expenses")
		.select("*")
		.eq("user_id", userId)
		.eq("is_active", true);

	if (!recurring || recurring.length === 0) return;

	// 2. Calculate total
	let totalRecurring = 0;

	for (const expense of recurring) {
		// Logic: active subscriptions hit the budget
		// Check billing period vs target month?
		// Spec: "Annual where we will track the one time expense for that month"

		let applies = false;
		if (expense.billing_period === "monthly") {
			applies = true;
		} else if (expense.billing_period === "yearly") {
			// Check if next_due_date month matches targetMonth
			// Note: date format is YYYY-MM-DD.
			const dueDate = new Date(expense.next_due_date);
			// JS Month is 0-indexed, targetMonth is 1-indexed (based on usage in page.tsx: now.getMonth() + 1)
			if (dueDate.getMonth() + 1 === targetMonth) {
				applies = true;
			}
		} else {
			applies = true;
		}

		if (applies) {
			totalRecurring += Number(expense.amount);
		}
	}

	if (totalRecurring === 0) return;

	// 3. Find or Create "Fixed Expenses" category
	const { data: categories } = await supabase
		.from("allocation_categories")
		.select("*")
		.eq("allocation_id", allocationId)
		.eq("name", "Fixed Expenses")
		.single();

	if (categories) {
		if (Number(categories.budget_cap) !== totalRecurring) {
			await supabase.from("allocation_categories").update({ budget_cap: totalRecurring }).eq("id", categories.id);
		}
	} else {
		// Create new
		await supabase.from("allocation_categories").insert({
			allocation_id: allocationId,
			user_id: userId,
			name: "Fixed Expenses",
			budget_cap: totalRecurring,
			is_recurring: true,
			display_order: 0, // Put at top
		});
	}
}

/**
 * Get allocation summary with categories and calculations
 * Uses the database RPC function for proper JSON serialization
 */
export async function getAllocationSummary(allocationId: string): Promise<AllocationSummary | null> {
	// Handle sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return sampleAllocationSummary;
	}

	const supabase = await createClient();

	const { data, error } = await supabase.rpc("get_allocation_summary", {
		p_allocation_id: allocationId,
	});

	if (error) {
		Logger.error("Error getting allocation summary", { error });
		return null;
	}

	return data as AllocationSummary;
}

/**
 * Get previous month's allocation summary for import preview
 */
export async function getPreviousMonthSummary(
	year: number,
	month: number
): Promise<{ summary: AllocationSummary | null; prevYear: number; prevMonth: number }> {
	// Calculate previous month (handle year boundary)
	const prevMonth = month === 1 ? 12 : month - 1;
	const prevYear = month === 1 ? year - 1 : year;

	// Get the previous month's allocation
	const prevAllocation = await getAllocation(prevYear, prevMonth);

	if (!prevAllocation) {
		return { summary: null, prevYear, prevMonth };
	}

	const summary = await getAllocationSummary(prevAllocation.id);
	return { summary, prevYear, prevMonth };
}

/**
 * Import previous month's categories to new month
 * Only copies categories and budget caps - NOT transactions
 */
export async function importPreviousMonthCategories(
	targetYear: number,
	targetMonth: number,
	expectedIncome: number
): Promise<Allocation | null> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	// Calculate previous month (handle year boundary)
	const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
	const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;

	// Get previous month's allocation
	const prevAllocation = await getAllocation(prevYear, prevMonth);

	// Create new allocation for target month
	const newAllocation = await getOrCreateAllocation(targetYear, targetMonth, expectedIncome);
	if (!newAllocation) return null;

	// If no previous allocation, just return the empty new allocation
	if (!prevAllocation) {
		return newAllocation;
	}

	// Fetch categories from previous month
	const { data: prevCategories, error: fetchError } = await supabase
		.from("allocation_categories")
		.select("*")
		.eq("allocation_id", prevAllocation.id)
		.order("display_order");

	if (fetchError || !prevCategories || prevCategories.length === 0) {
		return newAllocation;
	}

	// Copy categories to new allocation
	const newCategories = prevCategories.map((cat) => ({
		allocation_id: newAllocation.id,
		user_id: user.id,
		name: cat.name,
		budget_cap: cat.budget_cap,
		is_recurring: cat.is_recurring,
		display_order: cat.display_order,
		color: cat.color,
		icon: cat.icon,
		notes: cat.notes,
	}));

	const { error: insertError } = await supabase.from("allocation_categories").insert(newCategories);

	if (insertError) {
		Logger.error("Error copying categories", { error: insertError });
		// Return the allocation anyway - categories just weren't copied
	}

	revalidatePath("/allocations");
	return newAllocation;
}

/**
 * Update allocation expected income
 */
export async function updateExpectedIncome(allocationId: string, expectedIncome: number): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase
		.from("allocations")
		.update({ expected_income: expectedIncome })
		.eq("id", allocationId);

	if (error) {
		Logger.error("Error updating expected income", { error });
		return false;
	}

	revalidatePath("/allocations");
	return true;
}

/**
 * Create a new category
 */
export async function createCategory(
	allocationId: string,
	name: string,
	budgetCap: number,
	isRecurring: boolean = false,
	displayOrder?: number
): Promise<AllocationCategory | null> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	// Get the next display order if not provided
	if (displayOrder === undefined) {
		const { data: categories } = await supabase
			.from("allocation_categories")
			.select("display_order")
			.eq("allocation_id", allocationId)
			.order("display_order", { ascending: false })
			.limit(1);

		displayOrder = categories && categories.length > 0 ? categories[0].display_order + 1 : 0;
	}

	const { data, error } = await supabase
		.from("allocation_categories")
		.insert({
			allocation_id: allocationId,
			user_id: user.id,
			name,
			budget_cap: budgetCap,
			is_recurring: isRecurring,
			display_order: displayOrder,
		})
		.select()
		.single();

	if (error) {
		Logger.error("Error creating category", { error });
		return null;
	}

	revalidatePath("/allocations");
	return data as AllocationCategory;
}

/**
 * Update category budget cap
 */
export async function updateCategoryBudget(categoryId: string, budgetCap: number): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase.from("allocation_categories").update({ budget_cap: budgetCap }).eq("id", categoryId);

	if (error) {
		Logger.error("Error updating category budget", { error });
		return false;
	}

	revalidatePath("/allocations");
	return true;
}

/**
 * Update category name
 */
export async function updateCategoryName(categoryId: string, name: string): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase.from("allocation_categories").update({ name }).eq("id", categoryId);

	if (error) {
		Logger.error("Error updating category name", { error });
		return false;
	}

	revalidatePath("/allocations");
	return true;
}

/**
 * Delete a category
 */
export async function deleteCategory(categoryId: string): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase.from("allocation_categories").delete().eq("id", categoryId);

	if (error) {
		Logger.error("Error deleting category", { error });
		return false;
	}

	revalidatePath("/allocations");
	return true;
}

/**
 * Reorder categories
 */
export async function reorderCategories(categoryOrders: { id: string; display_order: number }[]): Promise<boolean> {
	// Handle sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return true;
	}

	const supabase = await createClient();

	// Update each category's display order
	const promises = categoryOrders.map(({ id, display_order }) =>
		supabase.from("allocation_categories").update({ display_order }).eq("id", id)
	);

	const results = await Promise.all(promises);

	if (results.some((result) => result.error)) {
		Logger.error("Error reordering categories");
		return false;
	}

	revalidatePath("/allocations");
	return true;
}

/**
 * Get transactions for a specific month
 */
export async function getTransactionsForMonth(year: number, month: number): Promise<Transaction[]> {
	// Handle sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return sampleTransactions;
	}

	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return [];

	// Calculate date range for the month
	const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
	const endDate = new Date(year, month, 0); // Last day of month
	const endDateStr = `${year}-${String(month).padStart(2, "0")}-${endDate.getDate()}`;

	const { data, error } = await supabase
		.from("transactions")
		.select(
			`
			*,
			category:allocation_categories(name)
		`
		)
		.eq("user_id", user.id)
		.gte("transaction_date", startDate)
		.lte("transaction_date", endDateStr)
		.order("transaction_date", { ascending: false });

	if (error) {
		Logger.error("Error fetching transactions", { error });
		return [];
	}

	// Flatten the category name into the transaction object
	return (data as any[]).map((t) => ({
		...t,
		category_name: t.category?.name,
		category: undefined,
	})) as Transaction[];
}

/**
 * Create a new transaction
 */
export async function createTransaction(
	name: string,
	amount: number,
	transactionDate: string,
	categoryId?: string,
	type: "income" | "expense" = "expense",
	notes?: string
): Promise<Transaction | null> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const { data, error } = await supabase
		.from("transactions")
		.insert({
			user_id: user.id,
			name,
			// Store amount as positive for income, negative for expense (if UI sends positive)
			// OR store absolute and rely on checks. Standard is signed values for easy math.
			// Let's assume UI sends absolute and we sign it here based on type.
			amount: type === "expense" ? -Math.abs(amount) : Math.abs(amount),
			transaction_date: transactionDate,
			category_id: categoryId || null,
			notes: notes || null,
		})
		.select()
		.single();

	if (error) {
		Logger.error("Error creating transaction", { error });
		return null;
	}

	revalidatePath("/allocations");
	revalidatePath("/dashboard");
	return data as Transaction;
}

/**
 * Update transaction
 */
export async function updateTransaction(
	transactionId: string,
	data: {
		name?: string;
		amount?: number;
		transactionDate?: string;
		categoryId?: string | null;
		type?: "income" | "expense";
		notes?: string;
	}
): Promise<boolean> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return false;

	const updates: any = {};
	if (data.name !== undefined) updates.name = data.name;
	if (data.transactionDate !== undefined) updates.transaction_date = data.transactionDate;
	if (data.categoryId !== undefined) updates.category_id = data.categoryId;
	if (data.notes !== undefined) updates.notes = data.notes;

	// Handle amount / type update
	// If amount is provided, we need to know the type (either new or existing)
	// For simplicity, we expect the UI to provide the raw signed amount or we handle it if type is passed
	if (data.amount !== undefined) {
		// If type is explicitly provided, enforce sign
		if (data.type) {
			updates.amount = data.type === "expense" ? -Math.abs(data.amount) : Math.abs(data.amount);
		} else {
			// If type is not changing, we update the amount directly.
			// We assume the UI sends the correct signed value if type isn't changing,
			// or that the existing sign is preserved if the UI sends absolute value.
			// Ideally, the UI should always send type if it sends amount to ensure correctness.
			updates.amount = data.amount;
		}
	}

	const { error } = await supabase.from("transactions").update(updates).eq("id", transactionId);

	if (error) {
		Logger.error("Error updating transaction", { error });
		return false;
	}

	revalidatePath("/allocations");
	revalidatePath("/dashboard");
	return true;
}

/**
 * Update transaction category (Simplified helper)
 */
export async function updateTransactionCategory(transactionId: string, categoryId: string | null): Promise<boolean> {
	return updateTransaction(transactionId, { categoryId });
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(transactionId: string): Promise<boolean> {
	const supabase = await createClient();

	const { error } = await supabase.from("transactions").delete().eq("id", transactionId);

	if (error) {
		Logger.error("Error deleting transaction", { error });
		return false;
	}

	revalidatePath("/allocations");
	return true;
}

/**
 * Get all templates for the current user
 */
export async function getUserTemplates(): Promise<AllocationTemplate[]> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return [];

	const { data, error } = await supabase.from("allocation_templates").select("*").eq("user_id", user.id).order("name");

	if (error) {
		Logger.error("Error fetching templates", { error });
		return [];
	}

	return data as AllocationTemplate[];
}

/**
 * Apply template to allocation
 */
export async function applyTemplateToAllocation(templateId: string, allocationId: string): Promise<boolean> {
	const supabase = await createClient();

	const { data, error } = await supabase.rpc("apply_template_to_allocation", {
		p_template_id: templateId,
		p_allocation_id: allocationId,
	});

	if (error) {
		Logger.error("Error applying template", { error });
		return false;
	}

	revalidatePath("/allocations");
	return true;
}

/**
 * Create template from current allocation
 */
export async function createTemplateFromAllocation(
	allocationId: string,
	templateName: string,
	description?: string
): Promise<AllocationTemplate | null> {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	// Create template
	const { data: template, error: templateError } = await supabase
		.from("allocation_templates")
		.insert({
			user_id: user.id,
			name: templateName,
			description,
		})
		.select()
		.single();

	if (templateError) {
		Logger.error("Error creating template", { error: templateError });
		return null;
	}

	// Copy categories from allocation to template
	const { data: categories } = await supabase
		.from("allocation_categories")
		.select("*")
		.eq("allocation_id", allocationId)
		.order("display_order");

	if (categories && categories.length > 0) {
		const templateCategories = categories.map((cat) => ({
			template_id: template.id,
			user_id: user.id,
			name: cat.name,
			budget_cap: cat.budget_cap,
			is_recurring: cat.is_recurring,
			display_order: cat.display_order,
			color: cat.color,
			icon: cat.icon,
			notes: cat.notes,
		}));

		const { error: categoriesError } = await supabase.from("template_categories").insert(templateCategories);

		if (categoriesError) {
			Logger.error("Error creating template categories", { error: categoriesError });
			// Clean up template
			await supabase.from("allocation_templates").delete().eq("id", template.id);
			return null;
		}
	}

	revalidatePath("/allocations");
	return template as AllocationTemplate;
}
