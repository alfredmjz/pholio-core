/**
 * How this month's spending compares with where it should be by today.
 *
 * "Where it should be" follows the user's own spending shape when we have one (the average
 * cumulative spend curve from past months, see `getHistoricalPace`), scaled to this month's
 * budget. Without that history it falls back to spending the budget evenly across the month.
 */

import { getDaysInMonth, parseLocalDate } from "@/lib/date-utils";

export type PaceStatus = "no_budget" | "under" | "on_pace" | "over_pace" | "over_budget";

export interface PaceExpense {
	/** YYYY-MM-DD (an ISO timestamp is accepted; only the date part is read). */
	date: string;
	/** Amount spent, as a positive number. */
	amount: number;
}

export interface MonthPaceInput {
	year: number;
	/** 1-12 */
	month: number;
	/** YYYY-MM-DD */
	today: string;
	budget: number;
	expenses: PaceExpense[];
	/** Average cumulative spend by day of month from past months (index 0 = day 1). */
	typicalCurve?: number[] | null;
}

export interface MonthPace {
	year: number;
	month: number;
	budget: number;
	spent: number;
	expectedByToday: number;
	/** spent - expectedByToday; positive means ahead of pace. */
	difference: number;
	dayOfMonth: number;
	daysInMonth: number;
	/** Days after today until the month ends. */
	daysLeft: number;
	/** Budget left, never below zero. */
	remaining: number;
	/** What can be spent per day from today to month end and still land on budget. */
	dailyAllowance: number;
	status: PaceStatus;
	usesTypicalCurve: boolean;
	/** Cumulative spend for each day up to today. */
	cumulative: number[];
	/** Expected cumulative spend for every day of the month. */
	expected: number[];
}

/** Within this share of the budget, spending counts as on pace. */
export const ON_PACE_TOLERANCE = 0.05;

function roundCents(value: number): number {
	return Math.round(value * 100) / 100;
}

function expectedCurve(budget: number, daysInMonth: number, typicalCurve?: number[] | null) {
	const usable = typicalCurve && typicalCurve.length >= daysInMonth && typicalCurve[daysInMonth - 1] > 0;
	if (!usable) {
		return {
			usesTypicalCurve: false,
			expected: Array.from({ length: daysInMonth }, (_, i) => roundCents((budget * (i + 1)) / daysInMonth)),
		};
	}
	const end = typicalCurve[daysInMonth - 1];
	return {
		usesTypicalCurve: true,
		expected: Array.from({ length: daysInMonth }, (_, i) =>
			roundCents((budget * Math.min(typicalCurve[i], end)) / end)
		),
	};
}

export function computeMonthPace(input: MonthPaceInput): MonthPace {
	const { year, month, budget } = input;
	const daysInMonth = getDaysInMonth(year, month);
	const today = parseLocalDate(input.today);

	const monthKey = year * 12 + (month - 1);
	const todayKey = today.getFullYear() * 12 + today.getMonth();
	const dayOfMonth = todayKey > monthKey ? daysInMonth : todayKey < monthKey ? 0 : today.getDate();

	const daily = new Array<number>(daysInMonth).fill(0);
	for (const expense of input.expenses) {
		const date = parseLocalDate(expense.date);
		if (date.getFullYear() !== year || date.getMonth() + 1 !== month) continue;
		const day = date.getDate();
		if (day > dayOfMonth) continue;
		daily[day - 1] += Math.abs(Number(expense.amount));
	}

	const cumulative: number[] = [];
	let running = 0;
	for (let i = 0; i < dayOfMonth; i++) {
		running += daily[i];
		cumulative.push(roundCents(running));
	}
	const spent = roundCents(running);

	const { expected, usesTypicalCurve } = expectedCurve(budget, daysInMonth, input.typicalCurve);
	const expectedByToday = dayOfMonth > 0 ? expected[dayOfMonth - 1] : 0;
	const difference = roundCents(spent - expectedByToday);

	const remaining = roundCents(Math.max(0, budget - spent));
	const daysLeft = daysInMonth - dayOfMonth;
	// Today still counts as a day to spend in.
	const dailyAllowance = roundCents(remaining / Math.max(1, daysLeft + (dayOfMonth > 0 ? 1 : 0)));

	let status: PaceStatus;
	if (budget <= 0) status = "no_budget";
	else if (spent > budget) status = "over_budget";
	else if (Math.abs(difference) <= budget * ON_PACE_TOLERANCE) status = "on_pace";
	else if (difference > 0) status = "over_pace";
	else status = "under";

	return {
		year,
		month,
		budget,
		spent,
		expectedByToday,
		difference,
		dayOfMonth,
		daysInMonth,
		daysLeft,
		remaining,
		dailyAllowance,
		status,
		usesTypicalCurve,
		cumulative,
		expected,
	};
}
