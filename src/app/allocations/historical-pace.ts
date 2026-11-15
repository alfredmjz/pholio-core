import { parseLocalDate, previousMonthOf } from "@/lib/date-utils";

export interface HistoricalPace {
	hasEnoughData: boolean;
	dailyAmounts: number[];
}

export function notEnoughPaceData(): HistoricalPace {
	return { hasEnoughData: false, dailyAmounts: [] };
}

/** The past months that had a budget, each with its total budget cap. Months without one say nothing about pace. */
export function allocationsWithBudget(
	allocations: Array<{ id: string; year: number; month: number }>,
	categories: Array<{ allocation_id: string; budget_cap: number | string }>
): Array<{ id: string; year: number; month: number; budget: number }> {
	const budgets = new Map<string, number>();
	for (const category of categories) {
		budgets.set(category.allocation_id, (budgets.get(category.allocation_id) || 0) + Number(category.budget_cap));
	}
	return allocations.flatMap((a) => {
		const budget = budgets.get(a.id) || 0;
		return budget > 0 ? [{ ...a, budget }] : [];
	});
}

/**
 * The typical cumulative spend by day of month: the average over the given past months of the running
 * total of that month's expenses. It needs more than 10 expenses in the month just before the current one.
 */
export function buildHistoricalPace(
	months: Array<{ year: number; month: number }>,
	expenses: Array<{ amount: number | string; transaction_date: string }>,
	currentYear: number,
	currentMonth: number
): HistoricalPace {
	interface PastMonthStats {
		daysInMonth: number;
		dailySpend: number[];
		transactionCount: number;
	}

	const monthStats = new Map<string, PastMonthStats>();
	for (const a of months) {
		const days = new Date(a.year, a.month, 0).getDate();
		monthStats.set(`${a.year}-${a.month}`, {
			daysInMonth: days,
			dailySpend: new Array(days).fill(0),
			transactionCount: 0,
		});
	}

	for (const t of expenses) {
		// Use parseLocalDate to avoid timezone shifts throwing dates off
		const date = parseLocalDate(t.transaction_date);
		const stats = monthStats.get(`${date.getFullYear()}-${date.getMonth() + 1}`);
		const d = date.getDate();
		if (stats && d >= 1 && d <= stats.daysInMonth) {
			stats.dailySpend[d - 1] += Math.abs(Number(t.amount));
			stats.transactionCount += 1;
		}
	}

	const prev = previousMonthOf(currentYear, currentMonth);
	const prevMonthStats = monthStats.get(`${prev.year}-${prev.month}`);
	if (!prevMonthStats || prevMonthStats.transactionCount <= 10) return notEnoughPaceData();

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

	// Days 29-31 carry the last known amount when no month had them.
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
