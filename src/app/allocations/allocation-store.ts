import { Logger } from "@/lib/logger";
import { demoSlice, type DataContext, type DemoContext, type SupabaseContext } from "@/lib/data-context.server";
import { parseLocalDate, calculateNextDueDate, getTodayDateString, formatDateString, stepDate } from "@/lib/date-utils";
import { getAllocationSettings, getTimezone } from "@/app/settings/actions";
import {
	canPostTransfer,
	isRecurringTransfer,
	recurringOccurrenceRow,
	type RecurringOccurrenceRow,
} from "@/app/recurring/recurring-occurrence";
import { getSmartMockData } from "@/mock-data/allocations";
import type { RegisteredPlan } from "@/app/accounts/types";
import { VIRTUAL_UNCATEGORIZED_ID } from "./types";
import type {
	Allocation,
	AllocationCategory,
	AllocationSummary,
	AllocationTemplate,
	IncomeVerificationResult,
	Transaction,
} from "./types";

export interface TemplateListItem {
	id: string;
	name: string;
	description?: string;
	categoryCount: number;
	totalBudget: number;
}

export interface NewCategory {
	allocationId: string;
	name: string;
	budgetCap: number;
	isRecurring: boolean;
	/** Placed after the last category when omitted. */
	displayOrder?: number;
	color?: string;
	contributionPlan: RegisteredPlan | null;
}

export type CategoryUpdate = Partial<Pick<AllocationCategory, "budget_cap" | "name" | "color" | "contribution_plan">>;

export interface HistoricalPace {
	hasEnoughData: boolean;
	dailyAmounts: number[];
}

export interface AllocationStore {
	/** The month's budget, or null. Reading it also posts due recurring payments into that month. */
	find(year: number, month: number): Promise<Allocation | null>;
	findOrCreate(year: number, month: number, expectedIncome: number): Promise<Allocation>;
	/** findOrCreate, then applies the user's default template when one is set in Settings. */
	findOrCreateWithDefaults(year: number, month: number): Promise<Allocation>;
	/** Copies last month's categories into this month, creating the month's budget if needed. */
	importPreviousMonth(year: number, month: number, expectedIncome: number): Promise<Allocation>;
	getSummary(allocationId: string): Promise<AllocationSummary | null>;
	listTransactionsForMonth(year: number, month: number): Promise<Transaction[]>;
	updateExpectedIncome(allocationId: string, expectedIncome: number): Promise<void>;
	createCategory(input: NewCategory): Promise<AllocationCategory>;
	updateCategory(categoryId: string, changes: CategoryUpdate): Promise<void>;
	deleteCategory(categoryId: string): Promise<void>;
	reorderCategories(orders: { id: string; display_order: number }[]): Promise<void>;
	listTemplates(): Promise<TemplateListItem[]>;
	applyTemplate(templateId: string, allocationId: string): Promise<void>;
	/** Saves (or overwrites, by name) a template from the allocation's categories. */
	createTemplate(allocationId: string, name: string, description?: string): Promise<AllocationTemplate>;
	getHistoricalPace(year: number, month: number): Promise<HistoricalPace>;
	getIncomeVerification(year: number, month: number): Promise<IncomeVerificationResult>;
}

type AdapterStore = Omit<AllocationStore, "findOrCreateWithDefaults">;

export function allocationStore(ctx: DataContext): AllocationStore {
	const store: AdapterStore = ctx.kind === "demo" ? demoAllocationStore(ctx) : supabaseAllocationStore(ctx);
	return {
		...store,
		async findOrCreateWithDefaults(year, month) {
			const [settings, allocation] = await Promise.all([getAllocationSettings(), store.findOrCreate(year, month, 0)]);
			if (settings.defaultTemplateId) await store.applyTemplate(settings.defaultTemplateId, allocation.id);
			return allocation;
		},
	};
}

function previousMonthOf(year: number, month: number) {
	return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function uncategorizedCategory(allocationId: string, userId: string): AllocationCategory {
	const now = new Date().toISOString();
	return {
		id: VIRTUAL_UNCATEGORIZED_ID,
		allocation_id: allocationId,
		user_id: userId,
		name: "Uncategorized",
		budget_cap: 0,
		is_recurring: false,
		display_order: 999,
		color: "gray",
		icon: "help-circle",
		notes: "Transactions without a category",
		created_at: now,
		updated_at: now,
		actual_spend: 0,
		remaining: 0,
		utilization_percentage: 0,
		transaction_count: 0,
	};
}

// ============================================================================
// Supabase
// ============================================================================

function supabaseAllocationStore({ db, userId }: SupabaseContext): AdapterStore {
	const findRow = async (year: number, month: number) => {
		const { data } = await db
			.from("allocations")
			.select("*")
			.eq("user_id", userId)
			.eq("year", year)
			.eq("month", month)
			.maybeSingle();
		return data as Allocation | null;
	};

	const sync = async (allocationId: string, year: number, month: number) => {
		const timezone = await getTimezone();
		await syncRecurringExpenses(db, allocationId, userId, month, year, timezone);
	};

	const store: AdapterStore = {
		async find(year, month) {
			const existing = await findRow(year, month);
			if (existing) await sync(existing.id, year, month);
			return existing;
		},

		async findOrCreate(year, month, expectedIncome) {
			const existing = await findRow(year, month);
			if (existing) {
				await sync(existing.id, year, month);
				return existing;
			}

			const { data, error } = await db
				.from("allocations")
				.insert({ user_id: userId, year, month, expected_income: expectedIncome })
				.select()
				.single();
			if (error) throw error;

			await sync(data.id, year, month);
			return data as Allocation;
		},

		async importPreviousMonth(year, month, expectedIncome) {
			const prev = previousMonthOf(year, month);
			const prevAllocation = await store.find(prev.year, prev.month);
			const allocation = await store.findOrCreate(year, month, expectedIncome);
			if (!prevAllocation) return allocation;

			const { data: prevCategories, error: fetchError } = await db
				.from("allocation_categories")
				.select("*")
				.eq("allocation_id", prevAllocation.id)
				.order("display_order");
			if (fetchError || !prevCategories || prevCategories.length === 0) return allocation;

			const { error } = await db.from("allocation_categories").upsert(
				prevCategories.map((cat) => ({
					allocation_id: allocation.id,
					user_id: userId,
					name: cat.name,
					budget_cap: cat.budget_cap,
					is_recurring: cat.is_recurring,
					display_order: cat.display_order,
					color: cat.color,
					icon: cat.icon,
					notes: cat.notes,
					contribution_plan: cat.contribution_plan ?? null,
				})),
				{ onConflict: "allocation_id, name", ignoreDuplicates: true }
			);
			if (error) Logger.error("Error copying categories", { error });

			return allocation;
		},

		async getSummary(allocationId) {
			const { data, error } = await db.rpc("get_allocation_summary", { p_allocation_id: allocationId });
			if (error) {
				Logger.error("Error getting allocation summary", { error });
				return null;
			}

			const summary = data as AllocationSummary;
			if (summary.categories) {
				const uncategorized = summary.categories.find(
					(c) => c.id === VIRTUAL_UNCATEGORIZED_ID || c.name.toLowerCase() === "uncategorized"
				);
				if (!uncategorized) {
					summary.categories.push(uncategorizedCategory(allocationId, summary.allocation.user_id));
				} else if (uncategorized.id !== VIRTUAL_UNCATEGORIZED_ID) {
					uncategorized.id = VIRTUAL_UNCATEGORIZED_ID;
				}
				summary.categories.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
			}
			return summary;
		},

		async listTransactionsForMonth(year, month) {
			const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
			const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

			const { data, error } = await db
				.from("transactions")
				.select(
					`
					*,
					category:allocation_categories(name),
					recurring_expense:recurring_expenses(id, is_active),
					linked_account_transaction:account_transactions!fk_linked_account_tx(
						id,
						account_id,
						amount
					)
				`
				)
				.eq("user_id", userId)
				.gte("transaction_date", startDate)
				.lte("transaction_date", endDate)
				.order("transaction_date", { ascending: false });
			if (error) {
				Logger.error("Error fetching transactions", { error });
				return [];
			}

			const rows = data as any[];

			// linked_account_transaction only points at the source side, so a transfer's
			// destination account comes from every account row linked back to the transaction.
			const linkedAccountTxMap = new Map<string, Array<{ id: string; account_id: string | null }>>();
			if (rows.length > 0) {
				const { data: linkedAccountTxs, error: linkedError } = await db
					.from("account_transactions")
					.select("id, account_id, linked_allocation_transaction_id")
					.in(
						"linked_allocation_transaction_id",
						rows.map((t) => t.id)
					);
				if (linkedError) {
					Logger.error("Error fetching linked account transactions", { error: linkedError });
				} else {
					for (const accountTx of linkedAccountTxs || []) {
						const key = accountTx.linked_allocation_transaction_id as string;
						const list = linkedAccountTxMap.get(key) ?? [];
						list.push({ id: accountTx.id, account_id: accountTx.account_id });
						linkedAccountTxMap.set(key, list);
					}
				}
			}

			return rows.map((t) => ({
				...t,
				category_name: t.category?.name,
				category: undefined,
				recurring_expense: undefined,
				is_recurring_stopped:
					(t.recurring_expense && t.recurring_expense.is_active === false) ||
					(t.source === "recurring" && !t.recurring_expense_id),
				account_id: t.linked_account_transaction?.account_id,
				linked_account_transactions: linkedAccountTxMap.get(t.id) ?? [],
			})) as Transaction[];
		},

		async updateExpectedIncome(allocationId, expectedIncome) {
			const { error } = await db
				.from("allocations")
				.update({ expected_income: expectedIncome })
				.eq("id", allocationId)
				.eq("user_id", userId);
			if (error) throw error;
		},

		async createCategory(input) {
			let displayOrder = input.displayOrder;
			if (displayOrder === undefined) {
				const { data: last } = await db
					.from("allocation_categories")
					.select("display_order")
					.eq("allocation_id", input.allocationId)
					.order("display_order", { ascending: false })
					.limit(1);
				displayOrder = last && last.length > 0 ? last[0].display_order + 1 : 0;
			}

			const { data, error } = await db
				.from("allocation_categories")
				.insert({
					allocation_id: input.allocationId,
					user_id: userId,
					name: input.name,
					budget_cap: input.budgetCap,
					is_recurring: input.isRecurring,
					display_order: displayOrder,
					color: input.color,
					contribution_plan: input.contributionPlan,
				})
				.select()
				.single();
			if (error) throw error;
			return data as AllocationCategory;
		},

		async updateCategory(categoryId, changes) {
			const { error } = await db
				.from("allocation_categories")
				.update(changes)
				.eq("id", categoryId)
				.eq("user_id", userId);
			if (error) throw error;
		},

		async deleteCategory(categoryId) {
			const { error } = await db.from("allocation_categories").delete().eq("id", categoryId).eq("user_id", userId);
			if (error) throw error;
		},

		async reorderCategories(orders) {
			const results = await Promise.all(
				orders.map(({ id, display_order }) =>
					db.from("allocation_categories").update({ display_order }).eq("id", id).eq("user_id", userId)
				)
			);
			const failed = results.find((result) => result.error);
			if (failed) throw failed.error;
		},

		async listTemplates() {
			const { data, error } = await db
				.from("allocation_templates")
				.select("*, template_categories(budget_cap)")
				.eq("user_id", userId)
				.order("name");
			if (error) {
				Logger.error("Error fetching templates", { error });
				return [];
			}
			return (data as any[]).map((t) => ({
				id: t.id,
				name: t.name,
				description: t.description,
				categoryCount: t.template_categories?.length || 0,
				totalBudget: t.template_categories?.reduce((sum: number, c: any) => sum + Number(c.budget_cap), 0) || 0,
			}));
		},

		async applyTemplate(templateId, allocationId) {
			const { error } = await db.rpc("apply_template_to_allocation", {
				p_template_id: templateId,
				p_allocation_id: allocationId,
			});
			if (error) throw error;
			await copyTemplateContributionPlans(db, templateId, allocationId);
		},

		async createTemplate(allocationId, name, description) {
			const { data: template, error: templateError } = await db
				.from("allocation_templates")
				.upsert({ user_id: userId, name, description }, { onConflict: "user_id, name" })
				.select()
				.single();
			if (templateError) throw templateError;

			// Saving over an existing template replaces its categories.
			await db.from("template_categories").delete().eq("template_id", template.id);

			const { data: categories } = await db
				.from("allocation_categories")
				.select("*")
				.eq("allocation_id", allocationId)
				.order("display_order");

			if (categories && categories.length > 0) {
				const { error } = await db.from("template_categories").insert(
					categories.map((cat) => ({
						template_id: template.id,
						name: cat.name,
						budget_cap: cat.budget_cap,
						is_recurring: cat.is_recurring,
						display_order: cat.display_order,
						color: cat.color,
						icon: cat.icon,
						notes: cat.notes,
						contribution_plan: cat.contribution_plan ?? null,
					}))
				);
				if (error) {
					await db.from("allocation_templates").delete().eq("id", template.id);
					throw error;
				}
			}

			return template as AllocationTemplate;
		},

		getHistoricalPace: (year, month) => historicalPace(db, userId, year, month),
		getIncomeVerification: (year, month) => incomeVerification(db, userId, year, month),
	};
	return store;
}

type Db = SupabaseContext["db"];

/**
 * apply_template_to_allocation() predates contribution plans, so carry each template
 * category's plan over to the matching (same name) allocation category afterwards.
 */
async function copyTemplateContributionPlans(db: Db, templateId: string, allocationId: string) {
	const { data: linked } = await db
		.from("template_categories")
		.select("name, contribution_plan")
		.eq("template_id", templateId)
		.not("contribution_plan", "is", null);
	if (!linked || linked.length === 0) return;

	const { data: categories } = await db
		.from("allocation_categories")
		.select("id, name")
		.eq("allocation_id", allocationId);

	const updates = (categories ?? []).flatMap((category) => {
		const match = linked.find((t) => t.name.toLowerCase() === category.name.toLowerCase());
		return match
			? [db.from("allocation_categories").update({ contribution_plan: match.contribution_plan }).eq("id", category.id)]
			: [];
	});

	const results = await Promise.all(updates);
	if (results.some((result) => result.error)) {
		Logger.error("Error copying template contribution plans");
	}
}

/**
 * The allocation category NAME a recurring expense should be bundled into.
 * An explicit `budget_category` wins; otherwise subscriptions fall back to the
 * auto-managed "Subscriptions" category and bills to "Bills".
 */
function resolveRecurringCategoryName(expense: { category: string; budget_category?: string | null }): string {
	const custom = expense.budget_category?.trim();
	if (custom) return custom;
	return expense.category === "bill" ? "Bills" : "Subscriptions";
}

/** Explicit user-chosen category name, or null when the expense uses the default bucket. */
function customRecurringCategoryName(expense: { budget_category?: string | null }): string | null {
	const custom = expense.budget_category?.trim();
	return custom ? custom : null;
}

async function syncRecurringExpenses(
	supabase: Db,
	allocationId: string,
	userId: string,
	targetMonth: number,
	targetYear: number,
	timezone?: string | null
) {
	const { data: allRecurring } = await supabase.from("recurring_expenses").select("*").eq("user_id", userId);

	if (!allRecurring) return;

	// Transfers post only while both of their accounts are active; until then they stay due.
	let activeAccountIds = new Set<string>();
	if (allRecurring.some((r) => r.is_active && isRecurringTransfer(r))) {
		const { data: activeAccounts } = await supabase
			.from("accounts")
			.select("id")
			.eq("user_id", userId)
			.eq("is_active", true);
		activeAccountIds = new Set((activeAccounts || []).map((a: { id: string }) => a.id));
	}
	const isPostable = (expense: (typeof allRecurring)[0]) =>
		!isRecurringTransfer(expense) || canPostTransfer(expense, activeAccountIds);

	const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
	const endDate = formatDateString(new Date(targetYear, targetMonth, 0));

	const { data: existingTransactions } = await supabase
		.from("transactions")
		.select("id, recurring_expense_id, transaction_date, covers_due_date, amount, name, category_id")
		.eq("user_id", userId)
		.gte("transaction_date", startDate)
		.lte("transaction_date", endDate)
		.not("recurring_expense_id", "is", null);

	// Occurrences that have already been recorded (with the amount at record time).
	// Auto-pay must never rewrite or re-create these, even after the transaction is
	// edited or deleted.
	const { data: recordedOccurrences } = await supabase
		.from("recurring_recorded_occurrences")
		.select("recurring_expense_id, occurrence_date, amount")
		.eq("user_id", userId);

	const recordedAmountByKey = new Map<string, number>();
	for (const marker of recordedOccurrences || []) {
		const markerDateStr = marker.occurrence_date ? marker.occurrence_date.split("T")[0] : "";
		recordedAmountByKey.set(`${marker.recurring_expense_id}:${markerDateStr}`, Number(marker.amount));
	}

	const hasBills = allRecurring.some((r) => r.category === "bill" && r.is_active && !customRecurringCategoryName(r));
	const hasSubscriptions = allRecurring.some(
		(r) => r.category === "subscription" && r.is_active && !customRecurringCategoryName(r)
	);

	let totalBills = 0;
	let totalSubscriptions = 0;

	// Active expenses with an explicit budget category, grouped by lowercase name.
	const customTotals = new Map<string, { name: string; total: number }>();

	const applicableExpenses: Array<{ expense: (typeof allRecurring)[0]; dates: Date[] }> = [];

	for (const expense of allRecurring) {
		if (!expense.is_active) continue;

		const occurrences: Date[] = [];
		const nextDue = parseLocalDate(expense.next_due_date);
		const billingPeriod = expense.billing_period;

		let normalizedFreq = billingPeriod;
		if (billingPeriod === "monthly") normalizedFreq = "1:months";
		else if (billingPeriod === "yearly") normalizedFreq = "1:years";
		else if (billingPeriod === "weekly") normalizedFreq = "1:weeks";
		else if (billingPeriod === "biweekly") normalizedFreq = "2:weeks";

		const [valueStr, unit] = normalizedFreq.includes(":") ? normalizedFreq.split(":") : ["1", normalizedFreq];
		const value = parseInt(valueStr) || 1;

		let current = new Date(nextDue);
		current.setHours(0, 0, 0, 0);

		const monthStart = new Date(targetYear, targetMonth - 1, 1);
		const monthEnd = new Date(targetYear, targetMonth, 0);

		// Step backward until current is before the target month
		while (current >= monthStart) {
			const prev = stepDate(current, value, unit, -1);
			if (prev.getTime() === current.getTime()) break;
			current = prev;
		}

		// Step forward and collect all occurrences within the target month
		while (current <= monthEnd) {
			if (current >= monthStart) {
				occurrences.push(new Date(current));
			}
			const next = stepDate(current, value, unit, 1);
			if (next.getTime() === current.getTime()) break;
			current = next;
		}

		if (occurrences.length > 0) {
			// Use the amount captured when the occurrence was recorded, so editing a
			// bill never retroactively changes the budget cap of a past month.
			const totalAmount = occurrences.reduce((sum, occurrenceDate) => {
				const recordedAmount = recordedAmountByKey.get(`${expense.id}:${formatDateString(occurrenceDate)}`);
				return sum + (recordedAmount !== undefined ? Math.abs(recordedAmount) : Math.abs(Number(expense.amount)));
			}, 0);
			applicableExpenses.push({ expense, dates: occurrences });

			// Transfers move money between the user's accounts; they are not budgeted spending.
			if (isRecurringTransfer(expense)) continue;

			const customName = customRecurringCategoryName(expense);
			if (customName) {
				const key = customName.toLowerCase();
				const existing = customTotals.get(key) ?? { name: customName, total: 0 };
				existing.total += totalAmount;
				customTotals.set(key, existing);
			} else if (expense.category === "bill") {
				totalBills += totalAmount;
			} else {
				totalSubscriptions += totalAmount;
			}
		}
	}

	// Recurring contributions are recomputed on every sync, so clear any stale
	// values before loading categories (only rows that actually had one are touched).
	await supabase
		.from("allocation_categories")
		.update({ recurring_budget_cap: 0 })
		.eq("allocation_id", allocationId)
		.gt("recurring_budget_cap", 0);

	const { data: allCategories } = await supabase
		.from("allocation_categories")
		.select("*")
		.eq("allocation_id", allocationId);

	const categoryMap = new Map((allCategories || []).map((c) => [c.name.toLowerCase(), c]));
	const categoryIdMap: Record<string, string> = {};
	// Resolved by allocation category NAME (lowercase) for both the default
	// Bills/Subscriptions buckets and any user-chosen budget categories.
	const categoryIdByName = new Map<string, string>();

	const billsCategory = categoryMap.get("bills");

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
		// Check if there are existing transactions in this allocation linked to billsCategory
		const { count: txCount } = await supabase
			.from("transactions")
			.select("id", { count: "exact", head: true })
			.eq("category_id", billsCategory.id);

		if (!hasBills && !customTotals.has("bills") && (!txCount || txCount === 0)) {
			const { error } = await supabase.from("allocation_categories").delete().eq("id", billsCategory.id);
			if (error) {
				Logger.warn("Failed to delete empty Bills category", { error, categoryId: billsCategory.id });

				// Ensure budget cap is 0 at least
				if (Number(billsCategory.budget_cap) !== 0) {
					await supabase.from("allocation_categories").update({ budget_cap: 0 }).eq("id", billsCategory.id);
				}
			}
		} else {
			categoryIdMap["bill"] = billsCategory.id;
			if (Number(billsCategory.budget_cap) !== 0) {
				await supabase.from("allocation_categories").update({ budget_cap: 0 }).eq("id", billsCategory.id);
			}
		}
	}

	const subsCategory = categoryMap.get("subscriptions");
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
		// Check if there are existing transactions in this allocation linked to subsCategory
		const { count: txCount } = await supabase
			.from("transactions")
			.select("id", { count: "exact", head: true })
			.eq("category_id", subsCategory.id);

		if (!hasSubscriptions && !customTotals.has("subscriptions") && (!txCount || txCount === 0)) {
			const { error } = await supabase.from("allocation_categories").delete().eq("id", subsCategory.id);
			if (error) {
				Logger.warn("Failed to delete empty Subscriptions category", { error, categoryId: subsCategory.id });

				// Ensure budget cap is 0 at least
				if (Number(subsCategory.budget_cap) !== 0) {
					await supabase.from("allocation_categories").update({ budget_cap: 0 }).eq("id", subsCategory.id);
				}
			}
		} else {
			// If there are existing transactions for this subscription category, preserve the existing budget
			// so that historical transactions don't show as "over budget" after a subscription is paused.
			categoryIdMap["subscription"] = subsCategory.id;
			if (hasSubscriptions) {
				// If there are active subscriptions, ensure the budget cap reflects the expected total (handled above when totalSubscriptions > 0).
			} else {
				// No active subscriptions: only zero the budget cap if there are no transactions present.
				if (!txCount || txCount === 0) {
					if (Number(subsCategory.budget_cap) !== 0) {
						await supabase.from("allocation_categories").update({ budget_cap: 0 }).eq("id", subsCategory.id);
					}
				}
			}
		}
	}

	// Map the default buckets to their resolved category ids.
	if (categoryIdMap["bill"]) categoryIdByName.set("bills", categoryIdMap["bill"]);
	if (categoryIdMap["subscription"]) categoryIdByName.set("subscriptions", categoryIdMap["subscription"]);

	// User-chosen categories: fold the recurring total into recurring_budget_cap.
	// The user-editable budget_cap (manual budget) is left untouched.
	for (const [key, entry] of Array.from(customTotals.entries())) {
		let customCategory = categoryMap.get(key);
		if (!customCategory) {
			const { data: newCat } = await supabase
				.from("allocation_categories")
				.insert({
					allocation_id: allocationId,
					user_id: userId,
					name: entry.name,
					budget_cap: 0,
					recurring_budget_cap: entry.total,
					is_recurring: false,
					display_order: 2,
					color: "blue",
				})
				.select()
				.single();
			if (newCat) {
				categoryMap.set(key, newCat);
				customCategory = newCat;
			}
		} else if (Number(customCategory.recurring_budget_cap) !== entry.total) {
			await supabase
				.from("allocation_categories")
				.update({ recurring_budget_cap: entry.total })
				.eq("id", customCategory.id);
			customCategory = { ...customCategory, recurring_budget_cap: entry.total };
		}
		if (customCategory) categoryIdByName.set(key, customCategory.id);
	}

	// A bill paid early, before this month's budget existed, was recorded without a category.
	const idsByCategory = new Map<string, string[]>();
	for (const transaction of existingTransactions || []) {
		if (transaction.category_id) continue;
		const expense = allRecurring.find((r) => r.id === transaction.recurring_expense_id);
		if (expense && isRecurringTransfer(expense)) continue;
		const categoryId = expense ? categoryIdByName.get(resolveRecurringCategoryName(expense).toLowerCase()) : undefined;
		if (categoryId) idsByCategory.set(categoryId, [...(idsByCategory.get(categoryId) ?? []), transaction.id]);
	}
	for (const [categoryId, ids] of Array.from(idsByCategory.entries())) {
		const { error } = await supabase.from("transactions").update({ category_id: categoryId }).in("id", ids);
		if (error) Logger.error("Error categorizing early recurring payments", { error });
	}

	const transactionsToCreate: RecurringOccurrenceRow[] = [];

	const existingTransactionMap = new Map(
		(existingTransactions || []).map((t) => {
			const covered = t.covers_due_date ?? t.transaction_date;
			const dateStr = covered ? covered.split("T")[0] : "";
			return [`${t.recurring_expense_id}:${dateStr}`, t];
		})
	);

	// --- Target month transactions (existing logic) ---
	for (const item of applicableExpenses) {
		const { expense, dates } = item;

		for (const dateObj of dates) {
			const dateStr = formatDateString(dateObj);
			const key = `${expense.id}:${dateStr}`;

			// A recorded occurrence is never rewritten or re-created. Edits to a
			// recurring expense only apply from the next unrecorded occurrence.
			if (existingTransactionMap.has(key) || recordedAmountByKey.has(key)) continue;

			if (!expense.is_active || !isPostable(expense)) continue;

			const meta = (expense.meta_data as any) || {};
			if (meta.is_automated === false) continue;

			const todayLocal = parseLocalDate(getTodayDateString(timezone || undefined));
			const targetDate = new Date(dateObj);
			targetDate.setHours(0, 0, 0, 0);

			if (targetDate > todayLocal) continue;

			transactionsToCreate.push(
				recurringOccurrenceRow(expense, {
					userId,
					transactionDate: dateStr,
					coversDueDate: dateStr,
					categoryId: categoryIdByName.get(resolveRecurringCategoryName(expense).toLowerCase()) ?? null,
					notes: `Auto-created from recurring ${expense.category}`,
				})
			);
		}
	}

	if (transactionsToCreate.length > 0) {
		const { error } = await supabase.from("transactions").insert(transactionsToCreate);
		if (error) {
			Logger.error("Error creating recurring transactions", { error });
		}
	}

	// --- Catch-up: backfill missed months for AUTO expenses ---
	const today = parseLocalDate(getTodayDateString(timezone || undefined));

	// Collect all missed occurrences across all expenses, grouped by month
	type MissedOccurrence = { expense: (typeof allRecurring)[0]; dateStr: string };
	const missedByMonth: Record<string, MissedOccurrence[]> = {};

	for (const expense of allRecurring) {
		if (!expense.is_active || !isPostable(expense)) continue;
		const meta = (expense.meta_data as any) || {};
		if (meta.is_automated === false) continue;

		let currentDue = parseLocalDate(expense.next_due_date);
		currentDue.setHours(0, 0, 0, 0);

		// Skip if already in the future
		if (currentDue > today) continue;

		// Walk through each occurrence from next_due_date up to today
		while (currentDue <= today) {
			const occMonth = currentDue.getMonth() + 1;
			const occYear = currentDue.getFullYear();
			const monthKey = `${occYear}-${occMonth}`;
			const dateStr = formatDateString(currentDue);

			// Skip occurrences that belong to the target month (already handled above)
			// and any occurrence that was already recorded (even if its transaction
			// was later deleted).
			if (occYear !== targetYear || occMonth !== targetMonth) {
				if (!recordedAmountByKey.has(`${expense.id}:${dateStr}`)) {
					if (!missedByMonth[monthKey]) {
						missedByMonth[monthKey] = [];
					}
					missedByMonth[monthKey].push({ expense, dateStr });
				}
			}

			currentDue = calculateNextDueDate(currentDue, expense.billing_period);
		}

		// Advance next_due_date to the next future occurrence
		const newDueDateStr = formatDateString(currentDue);
		const oldDueDateStr = expense.next_due_date.split("T")[0];

		if (newDueDateStr !== oldDueDateStr) {
			const { error: updateError } = await supabase
				.from("recurring_expenses")
				.update({ next_due_date: newDueDateStr })
				.eq("id", expense.id);

			if (updateError) {
				Logger.error(`Error advancing next_due_date for ${expense.name}`, { error: updateError });
			}
		}
	}

	// Process each missed month: find/create allocation, resolve categories, insert transactions
	for (const monthKey of Object.keys(missedByMonth)) {
		const items = missedByMonth[monthKey];
		const [yearStr, monthStr] = monthKey.split("-");
		const missedYear = parseInt(yearStr);
		const missedMonth = parseInt(monthStr);

		// Find or create allocation for this month (direct DB, no re-entrant sync)
		let missedAllocationId: string;
		const { data: existingAlloc } = await supabase
			.from("allocations")
			.select("id")
			.eq("user_id", userId)
			.eq("year", missedYear)
			.eq("month", missedMonth)
			.single();

		if (existingAlloc) {
			missedAllocationId = existingAlloc.id;
		} else {
			const { data: newAlloc, error: createErr } = await supabase
				.from("allocations")
				.insert({ user_id: userId, year: missedYear, month: missedMonth, expected_income: 0 })
				.select("id")
				.single();

			if (createErr || !newAlloc) {
				Logger.error(`Error creating allocation for ${missedYear}-${missedMonth}`, { error: createErr });
				continue;
			}
			missedAllocationId = newAlloc.id;
		}

		// Resolve category IDs for this month's allocation by name.
		const { data: missedCategories } = await supabase
			.from("allocation_categories")
			.select("id, name")
			.eq("allocation_id", missedAllocationId);

		const missedCategoryIdByName = new Map<string, string>();
		for (const cat of missedCategories || []) {
			missedCategoryIdByName.set(String(cat.name).toLowerCase(), cat.id);
		}

		// Group the missed items by the category name they resolve to and create
		// any category that doesn't exist yet.
		const missedNeeded = new Map<
			string,
			{ name: string; total: number; isDefault: boolean; defaultType: "bill" | "subscription" | null }
		>();
		for (const item of items) {
			if (isRecurringTransfer(item.expense)) continue;
			const custom = customRecurringCategoryName(item.expense);
			const name = custom ?? (item.expense.category === "bill" ? "Bills" : "Subscriptions");
			const key = name.toLowerCase();
			const entry = missedNeeded.get(key) ?? {
				name,
				total: 0,
				isDefault: !custom,
				defaultType: custom ? null : (item.expense.category as "bill" | "subscription"),
			};
			entry.total += Math.abs(Number(item.expense.amount));
			missedNeeded.set(key, entry);
		}

		for (const [key, entry] of Array.from(missedNeeded.entries())) {
			if (missedCategoryIdByName.has(key)) continue;
			const { data: newCat } = await supabase
				.from("allocation_categories")
				.insert({
					allocation_id: missedAllocationId,
					user_id: userId,
					name: entry.name,
					budget_cap: entry.isDefault ? entry.total : 0,
					recurring_budget_cap: entry.isDefault ? 0 : entry.total,
					is_recurring: entry.isDefault,
					display_order: entry.isDefault ? (entry.defaultType === "bill" ? 0 : 1) : 2,
					color: entry.isDefault ? (entry.defaultType === "bill" ? "orange" : "purple") : "blue",
				})
				.select("id")
				.single();

			if (newCat) missedCategoryIdByName.set(key, newCat.id);
		}

		// Check existing transactions for this month to dedup
		const missedMonthStart = `${missedYear}-${String(missedMonth).padStart(2, "0")}-01`;
		const missedMonthEnd = `${missedYear}-${String(missedMonth).padStart(2, "0")}-${new Date(missedYear, missedMonth, 0).getDate()}`;

		const { data: missedExisting } = await supabase
			.from("transactions")
			.select("recurring_expense_id, transaction_date, covers_due_date")
			.eq("user_id", userId)
			.gte("transaction_date", missedMonthStart)
			.lte("transaction_date", missedMonthEnd)
			.not("recurring_expense_id", "is", null);

		const missedExistingKeys = new Set(
			(missedExisting || []).map(
				(t) => `${t.recurring_expense_id}:${(t.covers_due_date ?? t.transaction_date).split("T")[0]}`
			)
		);

		const missedTransactions = items
			.filter((item: MissedOccurrence) => !missedExistingKeys.has(`${item.expense.id}:${item.dateStr}`))
			.map((item: MissedOccurrence) =>
				recurringOccurrenceRow(item.expense, {
					userId,
					transactionDate: item.dateStr,
					coversDueDate: item.dateStr,
					categoryId: missedCategoryIdByName.get(resolveRecurringCategoryName(item.expense).toLowerCase()) ?? null,
					notes: `Auto-created from recurring ${item.expense.category}`,
				})
			);

		if (missedTransactions.length > 0) {
			const { error } = await supabase.from("transactions").insert(missedTransactions);
			if (error) {
				Logger.error(`Error backfilling transactions for ${missedYear}-${missedMonth}`, { error });
			}
		}
	}
}

async function historicalPace(
	db: Db,
	userId: string,
	currentYear: number,
	currentMonth: number
): Promise<HistoricalPace> {
	const notEnough: HistoricalPace = { hasEnoughData: false, dailyAmounts: [] };

	// 1. Fetch up to 6 most recent past allocations
	const { data: pastAllocations, error: allocError } = await db
		.from("allocations")
		.select("id, year, month")
		.eq("user_id", userId)
		.or(`year.lt.${currentYear},and(year.eq.${currentYear},month.lt.${currentMonth})`)
		.order("year", { ascending: false })
		.order("month", { ascending: false })
		.limit(6);

	if (allocError || !pastAllocations || pastAllocations.length === 0) return notEnough;

	const allocIds = pastAllocations.map((a) => a.id);

	// 2. Fetch categories to compute total budget for these past months
	const { data: categories } = await db
		.from("allocation_categories")
		.select("allocation_id, budget_cap")
		.in("allocation_id", allocIds);

	const budgetMap = new Map<string, number>();
	categories?.forEach((c) => {
		budgetMap.set(c.allocation_id, (budgetMap.get(c.allocation_id) || 0) + Number(c.budget_cap));
	});

	// Filter allocations to only those with > 0 budget
	const validAllocations = pastAllocations.filter((a) => (budgetMap.get(a.id) || 0) > 0);
	if (validAllocations.length === 0) return notEnough;

	// 3. Fetch expenses for these past months
	const monthConditions = validAllocations
		.map((a) => {
			const start = `${a.year}-${String(a.month).padStart(2, "0")}-01`;
			const end = new Date(a.year, a.month, 0);
			const endStr = `${a.year}-${String(a.month).padStart(2, "0")}-${end.getDate()}`;
			return `and(transaction_date.gte.${start},transaction_date.lte.${endStr})`;
		})
		.join(",");

	const { data: transactions } = await db
		.from("transactions")
		.select("amount, transaction_date")
		.eq("user_id", userId)
		.lt("amount", 0) // Only expenses
		.or(monthConditions);

	// 4. Calculate daily spend percentages per month
	interface PastMonthStats {
		totalBudget: number;
		daysInMonth: number;
		dailySpend: number[];
		transactionCount: number;
	}

	const monthStats = new Map<string, PastMonthStats>();
	validAllocations.forEach((a) => {
		const days = new Date(a.year, a.month, 0).getDate();
		monthStats.set(`${a.year}-${a.month}`, {
			totalBudget: budgetMap.get(a.id) || 0,
			daysInMonth: days,
			dailySpend: new Array(days).fill(0),
			transactionCount: 0,
		});
	});

	transactions?.forEach((t) => {
		// Use parseLocalDate to avoid timezone shifts throwing dates off
		const date = parseLocalDate(t.transaction_date);
		const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
		const d = date.getDate();
		const stats = monthStats.get(key);
		if (stats && d >= 1 && d <= stats.daysInMonth) {
			stats.dailySpend[d - 1] += Math.abs(t.amount);
			stats.transactionCount += 1;
		}
	});

	// The pace needs more than 10 transactions in the month just before this one.
	const prev = previousMonthOf(currentYear, currentMonth);
	const prevMonthStats = monthStats.get(`${prev.year}-${prev.month}`);
	if (!prevMonthStats || prevMonthStats.transactionCount <= 10) return notEnough;

	const dailyAmountSums = new Array(31).fill(0);
	const dailyAmountCounts = new Array(31).fill(0);

	monthStats.forEach((stats) => {
		let cumulativeSpend = 0;
		for (let i = 0; i < stats.daysInMonth; i++) {
			cumulativeSpend += stats.dailySpend[i];
			dailyAmountSums[i] += cumulativeSpend;
			dailyAmountCounts[i] += 1;
		}
	});

	const averageDailyAmounts = dailyAmountSums.map((sum, i) =>
		dailyAmountCounts[i] === 0 ? 0 : sum / dailyAmountCounts[i]
	);

	// Make sure days 29-31 don't drop to 0 if no months have those lengths by carrying over last known amount
	let lastValidAmount = 0;
	for (let i = 0; i < averageDailyAmounts.length; i++) {
		if (dailyAmountCounts[i] > 0) {
			lastValidAmount = averageDailyAmounts[i];
		} else {
			averageDailyAmounts[i] = lastValidAmount;
		}
	}

	return { hasEnoughData: true, dailyAmounts: averageDailyAmounts };
}

const INCOME_MATCH_TOLERANCE = 0.05; // ±5%
const MONTHS_TO_VERIFY = 3;
const MONTHS_TO_DETECT_DRIFT = 2;
const MONTHS_TO_LOOK_BACK = 6;

async function incomeVerification(
	db: Db,
	userId: string,
	currentYear: number,
	currentMonth: number
): Promise<IncomeVerificationResult> {
	const defaultResult: IncomeVerificationResult = { status: "not_set", consecutiveMatches: 0, drift: null };

	// Past months to analyze, most recent first, excluding the current one.
	const monthsToCheck: { year: number; month: number }[] = [];
	let cursor = { year: currentYear, month: currentMonth };
	for (let i = 0; i < MONTHS_TO_LOOK_BACK; i++) {
		cursor = previousMonthOf(cursor.year, cursor.month);
		monthsToCheck.push(cursor);
	}

	const { data: allocations } = await db
		.from("allocations")
		.select("year, month, expected_income")
		.eq("user_id", userId)
		.order("year", { ascending: false })
		.order("month", { ascending: false })
		.limit(MONTHS_TO_LOOK_BACK + 1);

	if (!allocations || allocations.length === 0) return defaultResult;

	const allocationMap = new Map<string, number>();
	for (const alloc of allocations) {
		allocationMap.set(`${alloc.year}-${alloc.month}`, Number(alloc.expected_income));
	}

	// The current expected income comes from this month's budget, else the most recent one.
	const currentExpected =
		allocationMap.get(`${currentYear}-${currentMonth}`) ??
		(allocations.length > 0 ? Number(allocations[0].expected_income) : 0);

	if (currentExpected === 0) return defaultResult;

	const monthlyActuals: { year: number; month: number; actual: number; expected: number }[] = [];

	for (const { year, month } of monthsToCheck) {
		const expected = allocationMap.get(`${year}-${month}`);
		if (expected === undefined) continue;

		const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
		const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

		const { data: incomeTransactions } = await db
			.from("transactions")
			.select("amount, source, name, notes")
			.eq("user_id", userId)
			.gte("transaction_date", startDate)
			.lte("transaction_date", endDate)
			.gt("amount", 0) // Positive amounts = income
			.neq("source", "external") // Exclude one-time / external income
			.neq("source", "transfer"); // Exclude transfers

		const totalIncome = (incomeTransactions || [])
			.filter((t) => {
				const name = (t.name || "").toLowerCase();
				const notes = (t.notes || "").toLowerCase();
				return !name.includes("transfer") && !notes.includes("transfer");
			})
			.reduce((sum, t) => sum + Number(t.amount), 0);

		monthlyActuals.push({ year, month, actual: totalIncome, expected: Number(expected) });
	}

	if (monthlyActuals.length === 0) return { ...defaultResult, status: "tracking" };

	// Verification: consecutive months where actual ≈ expected (within tolerance)
	let consecutiveMatches = 0;
	for (const entry of monthlyActuals) {
		if (entry.expected === 0) break;
		const ratio = entry.actual / entry.expected;
		if (ratio >= 1 - INCOME_MATCH_TOLERANCE && ratio <= 1 + INCOME_MATCH_TOLERANCE) {
			consecutiveMatches++;
		} else {
			break;
		}
	}

	const status = consecutiveMatches >= MONTHS_TO_VERIFY ? "verified" : "tracking";

	// Drift: recent actual income consistently above or below expected, in one direction.
	let drift: IncomeVerificationResult["drift"] = null;

	if (monthlyActuals.length >= MONTHS_TO_DETECT_DRIFT) {
		let driftMonths = 0;
		let driftDirection: "increase" | "decrease" | null = null;
		let driftSum = 0;

		for (const entry of monthlyActuals) {
			if (entry.expected === 0 || entry.actual === 0) break;
			const ratio = entry.actual / entry.expected;

			if (ratio > 1 + INCOME_MATCH_TOLERANCE) {
				if (driftDirection === "decrease") break;
				driftDirection = "increase";
				driftMonths++;
				driftSum += entry.actual;
			} else if (ratio < 1 - INCOME_MATCH_TOLERANCE) {
				if (driftDirection === "increase") break;
				driftDirection = "decrease";
				driftMonths++;
				driftSum += entry.actual;
			} else {
				break;
			}
		}

		if (driftMonths >= MONTHS_TO_DETECT_DRIFT && driftDirection) {
			drift = {
				detected: true,
				direction: driftDirection,
				suggestedAmount: Math.round(driftSum / driftMonths),
				monthsObserved: driftMonths,
			};
		}
	}

	return { status, consecutiveMatches, drift };
}

// ============================================================================
// Demo
// ============================================================================

type DemoMonth = { summary: AllocationSummary; transactions: Transaction[] };
type DemoTemplate = { template: AllocationTemplate; categories: AllocationCategory[] };
type DemoAllocations = { months: Record<string, DemoMonth>; templates: DemoTemplate[] };

const DEMO_ALLOCATION_ID = /^sample-allocation-(\d{4})-(\d{1,2})$/;

function withTotals(summary: AllocationSummary): AllocationSummary {
	const totalBudget = summary.categories.reduce((sum, c) => sum + c.budget_cap + (c.recurring_budget_cap ?? 0), 0);
	const totalSpend = summary.categories.reduce((sum, c) => sum + (c.actual_spend ?? 0), 0);
	return {
		...summary,
		summary: {
			total_budget_caps: totalBudget,
			total_actual_spend: totalSpend,
			unallocated_funds: summary.allocation.expected_income - totalBudget,
			overall_utilization: totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0,
		},
	};
}

/** Every demo month has a populated budget, so the demo never lands on the empty setup flow. */
function demoAllocationStore(ctx: DemoContext): AdapterStore {
	const state = demoSlice<DemoAllocations>(ctx, "allocations", () => ({ months: {}, templates: [] }));

	const monthState = (year: number, month: number): DemoMonth =>
		(state.months[`${year}-${month}`] ??= getSmartMockData(year, month));

	const monthOfAllocation = (allocationId: string): DemoMonth | null => {
		const match = DEMO_ALLOCATION_ID.exec(allocationId);
		return match ? monthState(Number(match[1]), Number(match[2])) : null;
	};

	// Demo months are seeded from the same categories, so an edit applies wherever that id appears.
	const forEachCategory = (categoryId: string, edit: (month: DemoMonth, index: number) => void) => {
		for (const month of Object.values(state.months)) {
			const index = month.summary.categories.findIndex((c) => c.id === categoryId);
			if (index !== -1) edit(month, index);
		}
	};

	const store: AdapterStore = {
		async find(year, month) {
			return monthState(year, month).summary.allocation;
		},

		async findOrCreate(year, month) {
			return monthState(year, month).summary.allocation;
		},

		async importPreviousMonth(year, month) {
			return monthState(year, month).summary.allocation;
		},

		async getSummary(allocationId) {
			const month = monthOfAllocation(allocationId);
			return month ? withTotals(month.summary) : null;
		},

		async listTransactionsForMonth(year, month) {
			return monthState(year, month).transactions;
		},

		async updateExpectedIncome(allocationId, expectedIncome) {
			const month = monthOfAllocation(allocationId);
			if (month) month.summary.allocation = { ...month.summary.allocation, expected_income: expectedIncome };
		},

		async createCategory(input) {
			const month = monthOfAllocation(input.allocationId);
			if (!month) throw new Error(`Unknown demo allocation ${input.allocationId}`);
			const now = new Date().toISOString();
			const categories = month.summary.categories;
			const category: AllocationCategory = {
				id: `cat-${Date.now()}`,
				allocation_id: input.allocationId,
				user_id: ctx.userId,
				name: input.name,
				budget_cap: input.budgetCap,
				is_recurring: input.isRecurring,
				display_order: input.displayOrder ?? Math.max(0, ...categories.map((c) => c.display_order + 1)),
				color: input.color,
				contribution_plan: input.contributionPlan,
				created_at: now,
				updated_at: now,
				actual_spend: 0,
				remaining: input.budgetCap,
				utilization_percentage: 0,
				transaction_count: 0,
			};
			month.summary.categories = [...categories, category];
			return category;
		},

		async updateCategory(categoryId, changes) {
			forEachCategory(categoryId, (month, index) => {
				const categories = [...month.summary.categories];
				const updated = { ...categories[index], ...changes, updated_at: new Date().toISOString() };
				updated.remaining = updated.budget_cap - (updated.actual_spend ?? 0);
				categories[index] = updated;
				month.summary.categories = categories;
			});
		},

		async deleteCategory(categoryId) {
			forEachCategory(categoryId, (month) => {
				month.summary.categories = month.summary.categories.filter((c) => c.id !== categoryId);
			});
		},

		async reorderCategories(orders) {
			const orderById = new Map(orders.map((o) => [o.id, o.display_order]));
			for (const month of Object.values(state.months)) {
				month.summary.categories = month.summary.categories
					.map((c) => (orderById.has(c.id) ? { ...c, display_order: orderById.get(c.id)! } : c))
					.sort((a, b) => a.display_order - b.display_order);
			}
		},

		async listTemplates() {
			return state.templates.map(({ template, categories }) => ({
				id: template.id,
				name: template.name,
				description: template.description,
				categoryCount: categories.length,
				totalBudget: categories.reduce((sum, c) => sum + c.budget_cap, 0),
			}));
		},

		async applyTemplate(templateId, allocationId) {
			const template = state.templates.find((t) => t.template.id === templateId);
			const month = monthOfAllocation(allocationId);
			if (!template || !month) return;
			const taken = new Set(month.summary.categories.map((c) => c.name.toLowerCase()));
			const added = template.categories
				.filter((c) => !taken.has(c.name.toLowerCase()))
				.map((c, i) => ({
					...c,
					id: `cat-${Date.now()}-${i}`,
					allocation_id: allocationId,
					actual_spend: 0,
					remaining: c.budget_cap,
					utilization_percentage: 0,
					transaction_count: 0,
				}));
			month.summary.categories = [...month.summary.categories, ...added];
		},

		async createTemplate(allocationId, name, description) {
			const month = monthOfAllocation(allocationId);
			const categories = month ? month.summary.categories.map((c) => ({ ...c })) : [];
			const existing = state.templates.find((t) => t.template.name.toLowerCase() === name.toLowerCase());
			const now = new Date().toISOString();
			const template: AllocationTemplate = {
				id: existing?.template.id ?? `template-${Date.now()}`,
				user_id: ctx.userId,
				name,
				description,
				is_default: false,
				created_at: existing?.template.created_at ?? now,
				updated_at: now,
			};
			state.templates = [...state.templates.filter((t) => t !== existing), { template, categories }].sort((a, b) =>
				a.template.name.localeCompare(b.template.name)
			);
			return template;
		},

		async getHistoricalPace() {
			// Spends faster early in the month, then slows, up to $5,000.
			return {
				hasEnoughData: true,
				dailyAmounts: Array.from({ length: 31 }, (_, i) => Math.round(5000 * Math.pow((i + 1) / 31, 0.7))),
			};
		},

		async getIncomeVerification() {
			return { status: "verified", consecutiveMatches: 4, drift: null };
		},
	};
	return store;
}
