import type { AllocationCategory } from "../types";
import { VIRTUAL_UNCATEGORIZED_ID } from "../types";
import type { RegisteredPlan } from "@/app/accounts/types";
import type { AllocationContributions, ContributionSummary } from "@/lib/types/contribution";

export interface CategoryFigures {
	/** Budget including the system-managed recurring amount (the user edits `budget_cap`). */
	budget: number;
	/** What counts against the budget: spending, or real contributions for a linked plan. */
	spent: number;
	isUncategorized: boolean;
	/** Registered plan this budget counts toward, if any. */
	plan: RegisteredPlan | null;
	pool: ContributionSummary | null;
}

/**
 * One place for a category's budget and spend, so the plan ribbon and the category rows agree.
 * A category linked to a registered plan measures real contributions into that plan's accounts
 * (from the database), since those are what use contribution room.
 */
export function getCategoryFigures(
	category: AllocationCategory,
	contributions: AllocationContributions
): CategoryFigures {
	const isUncategorized = category.id === VIRTUAL_UNCATEGORIZED_ID;
	const plan = isUncategorized ? null : (contributions.categoryPlans[category.id] ?? null);
	const pool = plan ? (contributions.pools.find((p) => p.pool_key === plan) ?? null) : null;

	return {
		budget: category.budget_cap + (category.recurring_budget_cap ?? 0),
		spent: plan ? (pool?.month_contributions ?? 0) : category.actual_spend || 0,
		isUncategorized,
		plan,
		pool,
	};
}
