import { getDaysInMonth } from "@/lib/date-utils";

export type MonthPhase = "past" | "current" | "future";

export interface MonthDays {
	daysInMonth: number;
	phase: MonthPhase;
	/** Days of the month already gone (today is not one of them). */
	daysElapsed: number;
	/** Days still to come, counting today; 0 once the month has ended. */
	daysLeft: number;
}

/** Where `today` (YYYY-MM-DD) sits relative to a budget month (1-indexed). */
export function getMonthDays(year: number, month: number, today: string): MonthDays {
	const daysInMonth = getDaysInMonth(year, month);
	const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
	const order = todayYear * 12 + todayMonth - (year * 12 + month);

	if (order > 0) return { daysInMonth, phase: "past", daysElapsed: daysInMonth, daysLeft: 0 };
	if (order < 0) return { daysInMonth, phase: "future", daysElapsed: 0, daysLeft: daysInMonth };
	const daysElapsed = Math.min(Math.max(todayDay - 1, 0), daysInMonth - 1);
	return { daysInMonth, phase: "current", daysElapsed, daysLeft: daysInMonth - daysElapsed };
}

export interface BudgetPace extends MonthDays {
	budget: number;
	spent: number;
	/** Budget minus spent; negative when over. */
	left: number;
	over: boolean;
	/** How many day segments the spending fills, 0 to daysInMonth (fractional). */
	filledDays: number;
	/** Spent past the allowance through today (bills plus an even daily share of the rest); 0 when on pace or not the current month. */
	aheadBy: number;
	/** What's left spread over the days left; null when there is nothing to spread or no days. */
	perDay: number | null;
}

/** Below this, an amount rounds to nothing on screen. */
const CENT = 0.005;

/**
 * `bills` is the part of the budget for recurring bills, which are paid in one go, so it counts as
 * allowed from the first day; the rest is allowed an even share a day.
 */
export function getBudgetPace(days: MonthDays, budget: number, spent: number, bills = 0): BudgetPace {
	const hasBudget = budget > 0;
	const left = budget - spent;
	const over = hasBudget && left < -CENT;
	const filledDays = hasBudget ? Math.min(Math.max(spent / budget, 0), 1) * days.daysInMonth : 0;

	// Ahead of pace once spending runs more than a day's share past the allowance through today.
	const fixed = Math.min(Math.max(bills, 0), Math.max(budget, 0));
	const dailyShare = (Math.max(budget, 0) - fixed) / days.daysInMonth;
	const beyond = spent - (fixed + dailyShare * (days.daysElapsed + 1));
	const counts = days.phase === "current" && hasBudget && left > CENT && beyond > dailyShare;
	const aheadBy = counts ? beyond : 0;

	const perDay = hasBudget && left > CENT && days.daysLeft > 0 ? left / days.daysLeft : null;

	return { ...days, budget, spent, left, over, filledDays, aheadBy, perDay };
}

export type PaceTone = "success" | "error" | "muted";

const dayCount = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/**
 * The line under the bar, e.g. "$30 left to spend in 15 days". A category linked to a registered
 * plan counts contributions, so it reads "to contribute" instead.
 */
export function describeBudgetLeft(
	pace: BudgetPace,
	format: (amount: number) => string,
	isPlan = false
): { text: string; tone: PaceTone } {
	const { left, over, phase, daysLeft } = pace;
	const spentInFull = left <= CENT;

	if (phase === "past") {
		if (over) return { text: `${format(-left)} over budget`, tone: "error" };
		if (isPlan)
			return spentInFull
				? { text: "Contributed in full", tone: "muted" }
				: { text: `${format(left)} not contributed`, tone: "muted" };
		return spentInFull
			? { text: "Budget used", tone: "muted" }
			: { text: `Ended with ${format(left)} unspent`, tone: "success" };
	}

	if (over) return { text: `${format(-left)} over · ${dayCount(daysLeft)} to go`, tone: "error" };
	if (spentInFull) {
		return isPlan
			? { text: "Contributed in full", tone: "muted" }
			: { text: `Budget used · ${dayCount(daysLeft)} to go`, tone: "muted" };
	}

	const when = daysLeft === 1 ? "today" : `in ${dayCount(daysLeft)}`;
	return isPlan
		? { text: `${format(left)} to contribute ${when}`, tone: "muted" }
		: { text: `${format(left)} left to spend ${when}`, tone: "success" };
}

/** The caption under a category's name: how its spending compares with the month so far. */
export function describePace(pace: BudgetPace, format: (amount: number) => string, monthName: string): string {
	if (pace.budget <= 0) return "No budget set";
	if (pace.over) return "Over budget";
	if (pace.phase === "past") return `${Math.round((pace.spent / pace.budget) * 100)}% used`;
	if (pace.phase === "future") return `Starts ${monthName} 1`;
	if (pace.left <= CENT) return "100% used";
	if (pace.aheadBy > 0) return `Ahead of pace by ${format(pace.aheadBy)}`;
	return "On pace";
}
