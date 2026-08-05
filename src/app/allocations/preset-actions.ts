"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Logger } from "@/lib/logger";
import { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import { createUnifiedTransaction } from "@/lib/actions/unified-transaction-actions";

export interface TransactionPreset {
	id: string;
	user_id: string;
	name: string;
	description: string;
	amount: number;
	type: "income" | "expense";
	transaction_type: string;
	category_id: string | null;
	account_id: string | null;
	created_at?: string;
	updated_at?: string;
	category?: { name: string } | null;
}

export type CreateTransactionPresetInput = Omit<TransactionPreset, "id" | "user_id" | "created_at" | "updated_at">;

// In-memory mock presets for when SAMPLE_DATA is true
let mockPresets: TransactionPreset[] = [
	{
		id: "mock-preset-1",
		user_id: "mock-user",
		name: "Metro Fare",
		description: "Metro Fare",
		amount: 3.5,
		type: "expense",
		transaction_type: "withdrawal",
		category_id: "transportation-cat-id",
		account_id: "checking-account-id",
	},
];

/**
 * Get all presets for the current user
 */
export async function getTransactionPresets(): Promise<{ success: boolean; data?: TransactionPreset[]; error?: string }> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return { success: true, data: mockPresets };
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return { success: false, error: "You must be logged in" };
		}

		const { data, error } = await supabase
			.from("transaction_presets")
			.select("*, category:allocation_categories(name)")
			.eq("user_id", user.id)
			.order("created_at", { ascending: false });

		if (error) {
			Logger.error("Error fetching presets", { error });
			// If table doesn't exist yet, return empty list gracefully
			if (error.code === "42P01") {
				return { success: true, data: [] };
			}
			return { success: false, error: "Failed to load presets" };
		}

		return { success: true, data: data as TransactionPreset[] };
	} catch (error) {
		Logger.error("Unexpected error in getTransactionPresets", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

/**
 * Create a new preset
 */
export async function createTransactionPreset(input: CreateTransactionPresetInput): Promise<{ success: boolean; data?: TransactionPreset; error?: string }> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		const newPreset: TransactionPreset = {
			...input,
			id: `mock-preset-${Date.now()}`,
			user_id: "mock-user",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		mockPresets = [newPreset, ...mockPresets];
		revalidatePath("/allocations");
		return { success: true, data: newPreset };
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "You must be logged in" };
		}

		const { data, error } = await supabase
			.from("transaction_presets")
			.insert({
				user_id: user.id,
				...input,
			})
			.select()
			.single();

		if (error) {
			Logger.error("Error creating preset", { error, input });
			return { success: false, error: "Failed to create preset. Make sure migrations are applied." };
		}

		revalidatePath("/allocations");
		return { success: true, data: data as TransactionPreset };
	} catch (error) {
		Logger.error("Unexpected error in createTransactionPreset", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

/**
 * Update a preset
 */
export async function updateTransactionPreset(id: string, input: CreateTransactionPresetInput): Promise<{ success: boolean; data?: TransactionPreset; error?: string }> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		mockPresets = mockPresets.map((p) => (p.id === id ? { ...p, ...input, updated_at: new Date().toISOString() } : p));
		revalidatePath("/allocations");
		return { success: true };
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "You must be logged in" };
		}

		const { data, error } = await supabase
			.from("transaction_presets")
			.update(input)
			.eq("id", id)
			.eq("user_id", user.id)
			.select()
			.single();

		if (error) {
			Logger.error("Error updating preset", { error, input });
			return { success: false, error: "Failed to update preset" };
		}

		revalidatePath("/allocations");
		return { success: true, data: data as TransactionPreset };
	} catch (error) {
		Logger.error("Unexpected error in updateTransactionPreset", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

/**
 * Delete a preset
 */
export async function deleteTransactionPreset(id: string): Promise<{ success: boolean; error?: string }> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		mockPresets = mockPresets.filter((p) => p.id !== id);
		revalidatePath("/allocations");
		return { success: true };
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "You must be logged in" };
		}

		const { error } = await supabase
			.from("transaction_presets")
			.delete()
			.eq("id", id)
			.eq("user_id", user.id);

		if (error) {
			Logger.error("Error deleting preset", { error });
			return { success: false, error: "Failed to delete preset" };
		}

		revalidatePath("/allocations");
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in deleteTransactionPreset", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

/**
 * Resolve source category ID to the target month/year's category ID by name,
 * and create it in the target month/year's allocation if it does not exist.
 */
async function resolveCategoryForTargetDate(
	supabase: any,
	userId: string,
	sourceCategoryId: string | null,
	targetDateStr: string
): Promise<string | null> {
	if (!sourceCategoryId) return null;

	try {
		// 1. Get the name and details of the source category
		const { data: sourceCat } = await supabase
			.from("allocation_categories")
			.select("name, color, icon, is_recurring, display_order")
			.eq("id", sourceCategoryId)
			.single();

		if (!sourceCat) return null;

		const categoryName = sourceCat.name;

		// 2. Parse target date to get year and month
		const dateParts = targetDateStr.split("T")[0].split("-").map(Number);
		const targetYear = dateParts[0];
		const targetMonth = dateParts[1];

		if (!targetYear || !targetMonth) return null;

		// 3. Find or create allocation for target month
		let targetAllocationId: string;
		const { data: existingAlloc } = await supabase
			.from("allocations")
			.select("id")
			.eq("user_id", userId)
			.eq("year", targetYear)
			.eq("month", targetMonth)
			.single();

		if (existingAlloc) {
			targetAllocationId = existingAlloc.id;
		} else {
			// Create new allocation
			const { data: newAlloc, error: allocError } = await supabase
				.from("allocations")
				.insert({
					user_id: userId,
					year: targetYear,
					month: targetMonth,
					expected_income: 0,
				})
				.select("id")
				.single();

			if (allocError || !newAlloc) {
				Logger.error("Failed to create target allocation for preset", { error: allocError });
				return null;
			}
			targetAllocationId = newAlloc.id;
		}

		// 4. Find category with the same name in target allocation
		const { data: targetCat } = await supabase
			.from("allocation_categories")
			.select("id")
			.eq("allocation_id", targetAllocationId)
			.eq("name", categoryName)
			.single();

		if (targetCat) {
			return targetCat.id;
		}

		// 5. If it doesn't exist, create it in target allocation
		const { data: newCat, error: catError } = await supabase
			.from("allocation_categories")
			.insert({
				allocation_id: targetAllocationId,
				user_id: userId,
				name: categoryName,
				budget_cap: 0,
				is_recurring: sourceCat.is_recurring,
				display_order: sourceCat.display_order,
				color: sourceCat.color,
				icon: sourceCat.icon,
			})
			.select("id")
			.single();

		if (catError || !newCat) {
			Logger.error("Failed to create target category for preset", { error: catError });
			return null;
		}

		return newCat.id;
	} catch (error) {
		Logger.error("Error in resolveCategoryForTargetDate", { error });
		return null;
	}
}

/**
 * Create a transaction from a preset
 */
export async function createTransactionFromPreset(presetId: string, date: string): Promise<{ success: boolean; error?: string }> {
	const presetsRes = await getTransactionPresets();
	if (!presetsRes.success || !presetsRes.data) {
		return { success: false, error: presetsRes.error || "Failed to load presets" };
	}

	const preset = presetsRes.data.find(p => p.id === presetId);
	if (!preset) {
		return { success: false, error: "Preset not found" };
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { success: false, error: "Unauthorized" };
	}

	const resolvedCategoryId = await resolveCategoryForTargetDate(supabase, user.id, preset.category_id, date);

	const input: UnifiedTransactionInput = {
		description: preset.description,
		amount: preset.amount,
		date: date,
		type: preset.type,
		categoryId: resolvedCategoryId,
		accountId: preset.account_id,
		transactionType: preset.transaction_type as any,
		source: "manual",
	};

	return await createUnifiedTransaction(input);
}

/**
 * Create multiple transactions from a preset, compiling same-day entries into a single aggregated transaction.
 */
export async function createTransactionsFromPresetBulk(
	presetId: string,
	datesAndCounts: { date: string; count: number }[]
): Promise<{ success: boolean; error?: string }> {
	try {
		const presetsRes = await getTransactionPresets();
		if (!presetsRes.success || !presetsRes.data) {
			return { success: false, error: presetsRes.error || "Failed to load presets" };
		}

		const preset = presetsRes.data.find(p => p.id === presetId);
		if (!preset) {
			return { success: false, error: "Preset not found" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "Unauthorized" };
		}

		// Insert each aggregated transaction
		for (const entry of datesAndCounts) {
			if (entry.count <= 0) continue;

			const compiledAmount = preset.amount * entry.count;
			const compiledDescription = entry.count > 1 
				? `${preset.description} (x${entry.count})` 
				: preset.description;

			const resolvedCategoryId = await resolveCategoryForTargetDate(supabase, user.id, preset.category_id, entry.date);

			const input: UnifiedTransactionInput = {
				description: compiledDescription,
				amount: compiledAmount,
				date: entry.date,
				type: preset.type,
				categoryId: resolvedCategoryId,
				accountId: preset.account_id,
				transactionType: preset.transaction_type as any,
				source: "manual",
			};

			const res = await createUnifiedTransaction(input);
			if (!res.success) {
				Logger.error("Failed to insert preset transaction during bulk insert", { error: res.error, date: entry.date });
				return { success: false, error: `Failed to insert transaction for ${entry.date}: ${res.error}` };
			}
		}

		revalidatePath("/allocations");
		revalidatePath("/balancesheet");
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in createTransactionsFromPresetBulk", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

