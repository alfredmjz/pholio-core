"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { displayOrderSchema, idSchema, nonNegativeMoneySchema } from "@/lib/action-schemas";
import type { Allocation, AllocationPageData, AllocationSummary, IncomeVerificationResult, Transaction } from "./types";
import { allocationStore, type HistoricalPace, type TemplateListItem } from "./allocation-store";
import { loadAllocationPageData } from "./page-data.server";

const yearSchema = z.number().int().min(1970, "Pick a valid year.").max(9999, "Pick a valid year.");
const monthSchema = z.number().int().min(1, "Pick a valid month.").max(12, "Pick a valid month.");
const categoryNameSchema = z.string().trim().min(1, "Give the category a name.").max(100, "Use a shorter name.");
const colorSchema = z.string().min(1);
const contributionPlanSchema = z.enum(["fhsa", "resp", "rrsp", "tfsa"]).nullable();
const templateNameSchema = z.string().trim().min(1, "Give the template a name.");

export async function getAllocation(year: number, month: number): Promise<Allocation | null> {
	const ctx = await getReadContext();
	return ctx ? allocationStore(ctx).find(year, month) : null;
}

export async function getAllocationSummary(allocationId: string): Promise<AllocationSummary | null> {
	const ctx = await getReadContext();
	return ctx ? allocationStore(ctx).getSummary(allocationId) : null;
}

export async function getPreviousMonthSummary(
	year: number,
	month: number
): Promise<{ summary: AllocationSummary | null; prevYear: number; prevMonth: number }> {
	const prevMonth = month === 1 ? 12 : month - 1;
	const prevYear = month === 1 ? year - 1 : year;

	const ctx = await getReadContext();
	if (!ctx) return { summary: null, prevYear, prevMonth };

	const store = allocationStore(ctx);
	const prevAllocation = await store.find(prevYear, prevMonth);
	const summary = prevAllocation ? await store.getSummary(prevAllocation.id) : null;
	return { summary, prevYear, prevMonth };
}

export async function getTransactionsForMonth(year: number, month: number): Promise<Transaction[]> {
	const ctx = await getReadContext();
	return ctx ? allocationStore(ctx).listTransactionsForMonth(year, month) : [];
}

/** The page's catch-up refetch; the focus refetch reads the same data from /api/allocations/page-data. */
export async function getAllocationPageData(
	allocationId: string | null,
	year: number,
	month: number
): Promise<AllocationPageData> {
	const ctx = await getReadContext();
	if (!ctx) {
		return { summary: null, transactions: [], accounts: [], contributions: { pools: [], categoryPlans: {} } };
	}
	return loadAllocationPageData(ctx, allocationId, year, month);
}

export async function getUserTemplates(): Promise<TemplateListItem[]> {
	const ctx = await getReadContext();
	return ctx ? allocationStore(ctx).listTemplates() : [];
}

export async function getHistoricalPace(currentYear: number, currentMonth: number): Promise<HistoricalPace> {
	const ctx = await getReadContext();
	return ctx
		? allocationStore(ctx).getHistoricalPace(currentYear, currentMonth)
		: { hasEnoughData: false, dailyAmounts: [] };
}

export async function getIncomeVerification(
	currentYear: number,
	currentMonth: number
): Promise<IncomeVerificationResult> {
	const ctx = await getReadContext();
	return ctx
		? allocationStore(ctx).getIncomeVerification(currentYear, currentMonth)
		: { status: "not_set", consecutiveMatches: 0, drift: null };
}

export const getOrCreateAllocation = defineAction(
	"getOrCreateAllocation",
	[yearSchema, monthSchema, nonNegativeMoneySchema.default(0)],
	async (ctx, year, month, expectedIncome) => {
		const allocation = await allocationStore(ctx).findOrCreate(year, month, expectedIncome);
		revalidatePath("/allocations");
		return allocation;
	}
);

/** Creates the month's budget and applies the default template from Settings, if one is set. */
export const autoCreateAllocationWithDefaults = defineAction(
	"autoCreateAllocationWithDefaults",
	[yearSchema, monthSchema],
	async (ctx, year, month) => {
		const allocation = await allocationStore(ctx).findOrCreateWithDefaults(year, month);
		revalidatePath("/allocations");
		return allocation;
	}
);

export const importPreviousMonthCategories = defineAction(
	"importPreviousMonthCategories",
	[yearSchema, monthSchema, nonNegativeMoneySchema],
	async (ctx, targetYear, targetMonth, expectedIncome) => {
		const allocation = await allocationStore(ctx).importPreviousMonth(targetYear, targetMonth, expectedIncome);
		revalidatePath("/allocations");
		return allocation;
	}
);

export const updateExpectedIncome = defineAction(
	"updateExpectedIncome",
	[idSchema, nonNegativeMoneySchema],
	async (ctx, allocationId, expectedIncome) => {
		await allocationStore(ctx).updateExpectedIncome(allocationId, expectedIncome);
		revalidatePath("/allocations");
	}
);

export const createCategory = defineAction(
	"createCategory",
	[
		idSchema,
		categoryNameSchema,
		nonNegativeMoneySchema,
		z.boolean().default(false),
		z.number().int().optional(),
		colorSchema.optional(),
		contributionPlanSchema.default(null),
	],
	async (ctx, allocationId, name, budgetCap, isRecurring, displayOrder, color, contributionPlan) => {
		const category = await allocationStore(ctx).createCategory({
			allocationId,
			name,
			budgetCap,
			isRecurring,
			displayOrder,
			color,
			contributionPlan,
		});
		revalidatePath("/allocations");
		return category;
	}
);

export const updateCategoryBudget = defineAction(
	"updateCategoryBudget",
	[idSchema, nonNegativeMoneySchema],
	async (ctx, categoryId, budgetCap) => {
		await allocationStore(ctx).updateCategory(categoryId, { budget_cap: budgetCap });
		revalidatePath("/allocations");
	}
);

export const updateCategoryName = defineAction(
	"updateCategoryName",
	[idSchema, categoryNameSchema],
	async (ctx, categoryId, name) => {
		await allocationStore(ctx).updateCategory(categoryId, { name });
		revalidatePath("/allocations");
	}
);

export const updateCategoryColor = defineAction(
	"updateCategoryColor",
	[idSchema, colorSchema],
	async (ctx, categoryId, color) => {
		await allocationStore(ctx).updateCategory(categoryId, { color });
		revalidatePath("/allocations");
	}
);

/**
 * Links a budget category to a registered plan (or unlinks it with null). The budget is then
 * shown against that plan's contribution room; only real deposits use the room.
 */
export const updateCategoryContributionPlan = defineAction(
	"updateCategoryContributionPlan",
	[idSchema, contributionPlanSchema],
	async (ctx, categoryId, contributionPlan) => {
		await allocationStore(ctx).updateCategory(categoryId, { contribution_plan: contributionPlan });
		revalidatePath("/allocations");
	}
);

export const deleteCategory = defineAction("deleteCategory", [idSchema], async (ctx, categoryId) => {
	await allocationStore(ctx).deleteCategory(categoryId);
	revalidatePath("/allocations");
});

export const reorderCategories = defineAction(
	"reorderCategories",
	[displayOrderSchema],
	async (ctx, categoryOrders) => {
		await allocationStore(ctx).reorderCategories(categoryOrders);
		revalidatePath("/allocations");
	}
);

export const applyTemplateToAllocation = defineAction(
	"applyTemplateToAllocation",
	[idSchema, idSchema],
	async (ctx, templateId, allocationId) => {
		await allocationStore(ctx).applyTemplate(templateId, allocationId);
		revalidatePath("/allocations");
	}
);

export const createTemplateFromAllocation = defineAction(
	"createTemplateFromAllocation",
	[idSchema, templateNameSchema, z.string().optional()],
	async (ctx, allocationId, templateName, description) => {
		const template = await allocationStore(ctx).createTemplate(allocationId, templateName, description);
		revalidatePath("/allocations");
		return template;
	}
);
