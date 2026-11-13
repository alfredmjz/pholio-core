import { Logger } from "@/lib/logger";
import { demoSlice, type DataContext, type DemoContext, type SupabaseContext } from "@/lib/data-context.server";

export interface TransactionPreset {
	id: string;
	user_id: string;
	name: string;
	description: string;
	amount: number;
	type: "income" | "expense" | "transfer";
	transaction_type: string;
	category_id: string | null;
	/** For a transfer, the account the money leaves. */
	account_id: string | null;
	/** For a transfer, the account the money lands in; null for income and expenses. */
	to_account_id?: string | null;
	created_at?: string;
	updated_at?: string;
	category?: { name: string } | null;
}

export type CreateTransactionPresetInput = Omit<TransactionPreset, "id" | "user_id" | "created_at" | "updated_at">;

export type PresetFields = Omit<CreateTransactionPresetInput, "category">;

export interface PresetStore {
	/** Null when the presets could not be loaded. */
	list(): Promise<TransactionPreset[] | null>;
	get(id: string): Promise<TransactionPreset | null>;
	create(input: PresetFields): Promise<TransactionPreset>;
	/** Null when no such preset exists. */
	update(id: string, input: PresetFields): Promise<TransactionPreset | null>;
	remove(id: string): Promise<void>;
	/**
	 * The category with the same name in the budget month of `date`, created (with its month) when
	 * missing, so a preset saved in one month lands in the right month's category.
	 */
	categoryForDate(sourceCategoryId: string | null, date: string): Promise<string | null>;
}

export function presetStore(ctx: DataContext): PresetStore {
	return ctx.kind === "demo" ? demoPresetStore(ctx) : supabasePresetStore(ctx);
}

function supabasePresetStore({ db, userId }: SupabaseContext): PresetStore {
	return {
		async list() {
			const { data, error } = await db
				.from("transaction_presets")
				.select("*, category:allocation_categories(name)")
				.eq("user_id", userId)
				.order("created_at", { ascending: false });
			if (error) {
				Logger.error("Error fetching presets", { error });
				// The table may not exist yet on a database without the presets migration.
				return error.code === "42P01" ? [] : null;
			}
			return (data as TransactionPreset[]) ?? [];
		},

		async get(id) {
			const { data, error } = await db
				.from("transaction_presets")
				.select("*, category:allocation_categories(name)")
				.eq("id", id)
				.eq("user_id", userId)
				.maybeSingle();
			if (error) throw error;
			return (data as TransactionPreset | null) ?? null;
		},

		async create(input) {
			const { data, error } = await db
				.from("transaction_presets")
				.insert({ user_id: userId, ...input })
				.select()
				.single();
			if (error) throw error;
			return data as TransactionPreset;
		},

		async update(id, input) {
			const { data, error } = await db
				.from("transaction_presets")
				.update(input)
				.eq("id", id)
				.eq("user_id", userId)
				.select()
				.maybeSingle();
			if (error) throw error;
			return (data as TransactionPreset | null) ?? null;
		},

		async remove(id) {
			const { error } = await db.from("transaction_presets").delete().eq("id", id).eq("user_id", userId);
			if (error) throw error;
		},

		async categoryForDate(sourceCategoryId, date) {
			if (!sourceCategoryId) return null;

			try {
				const { data: sourceCat } = await db
					.from("allocation_categories")
					.select("name, color, icon, is_recurring, display_order")
					.eq("id", sourceCategoryId)
					.single();
				if (!sourceCat) return null;

				const [year, month] = date.split("T")[0].split("-").map(Number);
				if (!year || !month) return null;

				let allocationId: string;
				const { data: existingAlloc } = await db
					.from("allocations")
					.select("id")
					.eq("user_id", userId)
					.eq("year", year)
					.eq("month", month)
					.single();

				if (existingAlloc) {
					allocationId = existingAlloc.id;
				} else {
					const { data: newAlloc, error: allocError } = await db
						.from("allocations")
						.insert({ user_id: userId, year, month, expected_income: 0 })
						.select("id")
						.single();
					if (allocError || !newAlloc) {
						Logger.error("Failed to create target allocation for preset", { error: allocError });
						return null;
					}
					allocationId = newAlloc.id;
				}

				const { data: targetCat } = await db
					.from("allocation_categories")
					.select("id")
					.eq("allocation_id", allocationId)
					.eq("name", sourceCat.name)
					.single();
				if (targetCat) return targetCat.id;

				const { data: newCat, error: catError } = await db
					.from("allocation_categories")
					.insert({
						allocation_id: allocationId,
						user_id: userId,
						name: sourceCat.name,
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
				Logger.error("Error resolving preset category for date", { error });
				return null;
			}
		},
	};
}

function seedDemoPresets(): { presets: TransactionPreset[] } {
	return {
		presets: [
			{
				id: "mock-preset-1",
				user_id: "sample-user",
				name: "Metro Fare",
				description: "Metro Fare",
				amount: 3.5,
				type: "expense",
				transaction_type: "withdrawal",
				category_id: "transportation-cat-id",
				account_id: "acc-1",
			},
			{
				id: "mock-preset-2",
				user_id: "sample-user",
				name: "TFSA top-up",
				description: "TFSA top-up",
				amount: 200,
				type: "transfer",
				transaction_type: "transfer",
				category_id: null,
				account_id: "acc-1",
				to_account_id: "acc-3",
			},
		],
	};
}

function demoPresetStore(ctx: DemoContext): PresetStore {
	const state = demoSlice(ctx, "transaction-presets", seedDemoPresets);

	return {
		async list() {
			return state.presets;
		},

		async get(id) {
			return state.presets.find((p) => p.id === id) ?? null;
		},

		async create(input) {
			const now = new Date().toISOString();
			const preset: TransactionPreset = {
				...input,
				id: `mock-preset-${Date.now()}`,
				user_id: ctx.userId,
				created_at: now,
				updated_at: now,
			};
			state.presets = [preset, ...state.presets];
			return preset;
		},

		async update(id, input) {
			const existing = state.presets.find((p) => p.id === id);
			if (!existing) return null;
			const updated = { ...existing, ...input, updated_at: new Date().toISOString() };
			state.presets = state.presets.map((p) => (p.id === id ? updated : p));
			return updated;
		},

		async remove(id) {
			state.presets = state.presets.filter((p) => p.id !== id);
		},

		async categoryForDate(sourceCategoryId) {
			return sourceCategoryId;
		},
	};
}
