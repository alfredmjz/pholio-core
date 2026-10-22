/**
 * The month's plan as one ribbon: expected income split into each category's budget, plus the
 * part left unbudgeted.
 *
 * The ribbon spans the larger of income and total budgets, so an over-allocated month still
 * fits (its budgets simply run past where income ends). Each budget segment is filled by what
 * was spent in it. Spending with no budget behind it (uncategorized, or a category with a zero
 * budget) fills the unbudgeted part, because that is the money it actually came out of.
 */

export interface PlanCategoryInput {
	id: string;
	name: string;
	/** This month's budget, including any system-managed recurring amount. */
	budget: number;
	spent: number;
}

export interface PlanSegment {
	id: string;
	name: string;
	budget: number;
	spent: number;
	/** Share of the ribbon this budget takes, 0-100. */
	widthPercent: number;
	/** How much of this segment is spent, 0-100. */
	fillPercent: number;
	/** Spent past the budget, 0 when within it. */
	overBy: number;
}

export interface BudgetPlan {
	income: number;
	budgeted: number;
	spent: number;
	/** Budget not yet spent, summed per category (overspending in one doesn't eat another). */
	leftInBudget: number;
	/** Spending past budgets, summed per category. */
	overBudget: number;
	/** Income not given to any budget; negative when budgets exceed income. */
	notBudgeted: number;
	overAllocated: boolean;
	/** Spending with no budget behind it. */
	unbudgetedSpent: number;
	segments: PlanSegment[];
	remainder: {
		/** Share of the ribbon left unbudgeted, 0-100. */
		widthPercent: number;
		/** How much of the unbudgeted part has been spent, 0-100. */
		fillPercent: number;
	};
}

function roundCents(value: number): number {
	return Math.round(value * 100) / 100;
}

export function buildBudgetPlan(income: number, categories: PlanCategoryInput[]): BudgetPlan {
	const budgeted = categories.filter((c) => c.budget > 0);
	const unbudgetedSpent = roundCents(
		categories.filter((c) => c.budget <= 0).reduce((sum, c) => sum + Math.max(0, c.spent), 0)
	);

	const totalBudget = roundCents(budgeted.reduce((sum, c) => sum + c.budget, 0));
	const scale = Math.max(income, totalBudget, 0);
	const share = (amount: number) => (scale > 0 ? (amount / scale) * 100 : 0);

	const segments: PlanSegment[] = budgeted.map((c) => ({
		id: c.id,
		name: c.name,
		budget: c.budget,
		spent: c.spent,
		widthPercent: share(c.budget),
		fillPercent: Math.min(100, Math.max(0, (c.spent / c.budget) * 100)),
		overBy: roundCents(Math.max(0, c.spent - c.budget)),
	}));

	const notBudgeted = roundCents(income - totalBudget);
	const remainderAmount = Math.max(0, notBudgeted);

	return {
		income,
		budgeted: totalBudget,
		spent: roundCents(budgeted.reduce((sum, c) => sum + Math.max(0, c.spent), 0) + unbudgetedSpent),
		leftInBudget: roundCents(budgeted.reduce((sum, c) => sum + Math.max(0, c.budget - c.spent), 0)),
		overBudget: roundCents(segments.reduce((sum, s) => sum + s.overBy, 0)),
		notBudgeted,
		overAllocated: totalBudget > income,
		unbudgetedSpent,
		segments,
		remainder: {
			widthPercent: share(remainderAmount),
			fillPercent: remainderAmount > 0 ? Math.min(100, (unbudgetedSpent / remainderAmount) * 100) : 0,
		},
	};
}
