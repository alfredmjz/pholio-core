"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Allocation, AllocationCategory, AllocationSummary, AllocationTemplate, Transaction } from "./types";
import { sampleAllocationSummary, sampleTransactions } from "@/mock-data/allocations";
import { Logger } from "@/lib/logger";
import { parseLocalDate } from "@/lib/date-utils";

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

	if (existing) {
		await syncRecurringExpenses(existing.id, user.id, month, year);
	}

	return existing as Allocation | null;
}

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
		await syncRecurringExpenses(existing.id, user.id, month, year);
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

	await syncRecurringExpenses(newAllocation.id, user.id, month, year);

	return newAllocation as Allocation;
}

async function syncRecurringExpenses(allocationId: string, userId: string, targetMonth: number, targetYear: number) {
	const supabase = await createClient();

	const { data: allRecurring } = await supabase.from("recurring_expenses").select("*").eq("user_id", userId);

	if (!allRecurring) return;

	const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
	const endOfMonth = new Date(targetYear, targetMonth, 0);
	const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${endOfMonth.getDate()}`;

	const { data: existingTransactions } = await supabase
		.from("transactions")
		.select("id, recurring_expense_id, transaction_date")
		.eq("user_id", userId)
		.gte("transaction_date", startDate)
		.lte("transaction_date", endDate)
		.not("recurring_expense_id", "is", null);

	const existingRecurringIds = new Set((existingTransactions || []).map((t) => t.recurring_expense_id));

	const hasBills = allRecurring.some((r) => r.category === "bill");
	const hasSubscriptions = allRecurring.some((r) => r.category === "subscription");

	let totalBills = 0;
	let totalSubscriptions = 0;

	const applicableExpenses: Array<{ expense: (typeof allRecurring)[0]; dates: Date[] }> = [];

	for (const expense of allRecurring) {
		const occurrences: Date[] = [];
		const nextDue = parseLocalDate(expense.next_due_date);
		const billingPeriod = expense.billing_period;

		const isInMonth = (d: Date) => d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;

		if (billingPeriod === "monthly") {
			// Use the day of month from next_due_date
			const day = nextDue.getDate();
			const projected = new Date(targetYear, targetMonth - 1, day);

			if (projected.getMonth() !== targetMonth - 1) {
				projected.setDate(0);
			}

			if (isInMonth(projected)) occurrences.push(projected);
		} else if (billingPeriod === "yearly") {
			if (nextDue.getMonth() + 1 === targetMonth) {
				const projected = new Date(targetYear, nextDue.getMonth(), nextDue.getDate());
				if (isInMonth(projected)) occurrences.push(projected);
			}
		} else if (billingPeriod === "weekly" || billingPeriod === "biweekly") {
			const periodDays = billingPeriod === "weekly" ? 7 : 14;
			const msPerDay = 1000 * 60 * 60 * 24;
			const periodMs = periodDays * msPerDay;

			let current = new Date(nextDue);

			current.setHours(0, 0, 0, 0);
			const startMs = parseLocalDate(startDate).getTime();
			const endMs = parseLocalDate(endDate).getTime();

			while (current.getTime() > endMs) {
				current.setDate(current.getDate() - periodDays);
			}

			while (current.getTime() < startMs) {
				current.setDate(current.getDate() + periodDays);
			}

			while (current.getTime() <= endMs && current.getTime() >= startMs) {
				occurrences.push(new Date(current));
				current.setDate(current.getDate() + periodDays);
			}
		}

		if (occurrences.length > 0) {
			const totalAmount = Number(expense.amount) * occurrences.length;
			applicableExpenses.push({ expense, dates: occurrences });

			if (expense.category === "bill") {
				totalBills += totalAmount;
			} else {
				totalSubscriptions += totalAmount;
			}
		}
	}

	const { data: allCategories } = await supabase
		.from("allocation_categories")
		.select("*")
		.eq("allocation_id", allocationId);

	const categoryMap = new Map((allCategories || []).map((c) => [c.name, c]));
	const categoryIdMap: Record<string, string> = {};

	const billsCategory = categoryMap.get("Bills");

	if (totalBills > 0) {
		if (!billsCategory) {
			const { data: newCat } = await supabase
				.from("allocation_categories")
				.insert({
					allocation_id: allocationId,
					user_id: userId,
					name: "Bills",
					budget_cap: totalBills,
					is_recurring: true,
					display_order: 0,
					color: "orange",
				})
				.select()
				.single();
			if (newCat) {
				categoryMap.set("Bills", newCat);
				categoryIdMap["bill"] = newCat.id;
			}
		} else {
			if (Number(billsCategory.budget_cap) !== totalBills) {
				await supabase.from("allocation_categories").update({ budget_cap: totalBills }).eq("id", billsCategory.id);
			}
			categoryIdMap["bill"] = billsCategory.id;
		}
	} else if (billsCategory && billsCategory.is_recurring) {
		if (!hasBills) {
			const { error: unlinkError } = await supabase
				.from("transactions")
				.update({ category_id: null })
				.eq("category_id", billsCategory.id);
			if (unlinkError)
				Logger.warn("Failed to unlink transactions before deleting Bills category", { error: unlinkError });

			const { error } = await supabase.from("allocation_categories").delete().eq("id", billsCategory.id);
			if (error) {
				Logger.warn("Failed to delete empty Bills category", { error, categoryId: billsCategory.id });

				// Ensure budget cap is 0 at least
				if (Number(billsCategory.budget_cap) !== 0) {
					await supabase.from("allocation_categories").update({ budget_cap: 0 }).eq("id", billsCategory.id);
				}
			}
		} else {
			if (Number(billsCategory.budget_cap) !== 0) {
				await supabase.from("allocation_categories").update({ budget_cap: 0 }).eq("id", billsCategory.id);
			}
		}
	}

	const subsCategory = categoryMap.get("Subscriptions");
	if (totalSubscriptions > 0) {
		if (!subsCategory) {
			const { data: newCat } = await supabase
				.from("allocation_categories")
				.insert({
					allocation_id: allocationId,
					user_id: userId,
					name: "Subscriptions",
					budget_cap: totalSubscriptions,
					is_recurring: true,
					display_order: 1,
					color: "purple",
				})
				.select()
				.single();
			if (newCat) {
				categoryMap.set("Subscriptions", newCat);
				categoryIdMap["subscription"] = newCat.id;
			}
		} else {
			if (Number(subsCategory.budget_cap) !== totalSubscriptions) {
				await supabase
					.from("allocation_categories")
					.update({ budget_cap: totalSubscriptions })
					.eq("id", subsCategory.id);
			}
			categoryIdMap["subscription"] = subsCategory.id;
		}
	} else if (subsCategory && subsCategory.is_recurring) {
		if (!hasSubscriptions) {
			await supabase.from("transactions").update({ category_id: null }).eq("category_id", subsCategory.id);

			const { error } = await supabase.from("allocation_categories").delete().eq("id", subsCategory.id);
			if (error) {
				Logger.warn("Failed to delete empty Subscriptions category", { error, categoryId: subsCategory.id });

				if (Number(subsCategory.budget_cap) !== 0) {
					await supabase.from("allocation_categories").update({ budget_cap: 0 }).eq("id", subsCategory.id);
				}
			}
		} else {
			if (Number(subsCategory.budget_cap) !== 0) {
				await supabase.from("allocation_categories").update({ budget_cap: 0 }).eq("id", subsCategory.id);
			}
		}
	}

	const transactionsToCreate: Array<{
		user_id: string;
		name: string;
		amount: number;
		transaction_date: string;
		category_id: string | null;
		source: string;
		recurring_expense_id: string;
		notes: string;
	}> = [];

	const existingTransactionKeys = new Set(
		(existingTransactions || []).map((t) => {
			const dateStr = t.transaction_date ? t.transaction_date.split("T")[0] : "";
			return `${t.recurring_expense_id}:${dateStr}`;
		})
	);

	for (const item of applicableExpenses) {
		const { expense, dates } = item;

		for (const dateObj of dates) {
			const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
			const key = `${expense.id}:${dateStr}`;

			if (existingTransactionKeys.has(key)) continue;

			if (!expense.is_active) continue;

			const meta = (expense.meta_data as any) || {};
			if (meta.is_automated === false) continue;

			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const targetDate = new Date(dateObj);
			targetDate.setHours(0, 0, 0, 0);

			if (targetDate > today) continue;

			const categoryId = categoryIdMap[expense.category] || null;

			transactionsToCreate.push({
				user_id: userId,
				name: expense.name,
				amount: -Math.abs(Number(expense.amount)), // Expenses are negative
				transaction_date: dateStr,
				category_id: categoryId,
				source: "recurring",
				recurring_expense_id: expense.id,
				notes: `Auto-created from recurring ${expense.category}`,
			});
		}
	}

	if (transactionsToCreate.length > 0) {
		const { error } = await supabase.from("transactions").insert(transactionsToCreate);
		if (error) {
			Logger.error("Error creating recurring transactions", { error });
		}
	}
}

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
	}

	revalidatePath("/allocations");
	return newAllocation;
}

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

	if (data.amount !== undefined) {
		if (data.type) {
			updates.amount = data.type === "expense" ? -Math.abs(data.amount) : Math.abs(data.amount);
		} else {
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

export async function updateTransactionCategory(transactionId: string, categoryId: string | null): Promise<boolean> {
	return updateTransaction(transactionId, { categoryId });
}

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
