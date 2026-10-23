import type { DashboardData, Transaction } from "@/app/dashboard/types";
import type { AllocationSummary } from "@/app/allocations/types";
import { buildNetWorthSeries, type BalanceRecord } from "@/app/dashboard/net-worth-series";
import { computeMonthPace, type PaceExpense } from "@/app/dashboard/month-pace";
import { buildMonthlyCashflow, isTransfer, type CashflowTransaction } from "@/app/dashboard/cashflow";
import { buildHeadsUp, selectUpcomingBills, type BillInput, type HeadsUpPromotion } from "@/app/dashboard/heads-up";
import { getDaysInMonth } from "@/lib/date-utils";
import type { WeatherInput } from "@/lib/financial-weather";
import { accountsForWeather, billsForWeather } from "@/lib/weather-input";
import { sampleAccounts } from "./accounts";
import { getSmartMockData } from "./allocations";
import { getDemoNow, daysBefore, toDateOnly } from "./demo-date";

/** Recent transactions dated relative to `now`, so the demo always looks current. */
export function getSampleRecentTransactions(now: Date = getDemoNow()): Transaction[] {
	const rows: Array<Omit<Transaction, "id" | "date"> & { daysAgo: number }> = [
		{
			daysAgo: 1,
			description: "Whole Foods Market",
			category: "Groceries",
			amount: 154.32,
			type: "expense",
			account: "Credit Card",
		},
		{
			daysAgo: 2,
			description: "Uber Ride",
			category: "Transportation",
			amount: 24.5,
			type: "expense",
			account: "Credit Card",
		},
		{
			daysAgo: 3,
			description: "Salary Deposit",
			category: "Income",
			amount: 4250.0,
			type: "income",
			account: "Checking",
		},
		{
			daysAgo: 4,
			description: "Netflix Subscription",
			category: "Entertainment",
			amount: 15.99,
			type: "expense",
			account: "Credit Card",
		},
		{
			daysAgo: 5,
			description: "Move to emergency fund",
			category: "Transfer",
			amount: 500,
			type: "transfer",
			account: "Checking",
		},
		{
			daysAgo: 6,
			description: "Electric Bill",
			category: "Utilities",
			amount: 125.0,
			type: "expense",
			account: "Checking",
		},
	];

	return rows.map(({ daysAgo, ...row }, index) => ({
		id: `tx-demo-${index + 1}`,
		date: toDateOnly(daysBefore(now, daysAgo)),
		...row,
	}));
}

/** Deterministic random numbers so the demo looks the same on every reload. */
function createRandom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value = (value * 1664525 + 1013904223) >>> 0;
		return value / 4294967296;
	};
}

/**
 * A year of weekly balance records per sample account, drifting from a starting balance to the
 * account's current balance with a little noise, so the net worth line has a believable shape.
 */
function sampleBalanceRecords(now: Date): BalanceRecord[] {
	const random = createRandom(20261020);
	const starts: Record<string, number> = {
		"acc-1": 7000, // Emergency Fund, built up over the year
		"acc-2": 28500, // Robinhood, market growth
		"acc-3": 41000, // TFSA, contributions plus growth
		"acc-4": 2600, // Credit card balance moves around
		"acc-5": 20200, // Student loan, paid down
	};
	const noise: Record<string, number> = {
		"acc-1": 0.006,
		"acc-2": 0.022,
		"acc-3": 0.008,
		"acc-4": 0.15,
		"acc-5": 0.001,
	};
	const weeks = 52;
	const records: BalanceRecord[] = [];

	for (const account of sampleAccounts) {
		const start = starts[account.id] ?? Number(account.current_balance);
		const end = Number(account.current_balance);
		for (let week = weeks; week >= 1; week--) {
			const progress = (weeks - week) / weeks;
			// Ease-in so recent months move a little faster, like compounding.
			const base = start + (end - start) * Math.pow(progress, 1.15);
			const jitter = base * (noise[account.id] ?? 0.01) * (random() * 2 - 1);
			records.push({
				accountId: account.id,
				balance: Math.max(0, Math.round((base + jitter) * 100) / 100),
				date: toDateOnly(daysBefore(now, week * 7)),
			});
		}
	}
	return records;
}

/** This month's spending up to today: rent on the 1st, then smaller day-to-day purchases. */
function sampleMonthExpenses(now: Date, budget: number): PaceExpense[] {
	const random = createRandom(now.getFullYear() * 100 + now.getMonth());
	const year = now.getFullYear();
	const month = now.getMonth();
	const daysInMonth = getDaysInMonth(year, month + 1);
	const rent = 1400;
	// Day-to-day spending runs a little under budget so the demo reads "on pace".
	const dailyAverage = ((budget - rent) / daysInMonth) * 0.92;

	const expenses: PaceExpense[] = [{ date: toDateOnly(new Date(year, month, 1)), amount: rent }];
	for (let day = 1; day <= now.getDate(); day++) {
		const amount = Math.round(dailyAverage * (0.4 + random() * 1.2) * 100) / 100;
		expenses.push({ date: toDateOnly(new Date(year, month, day)), amount });
	}
	return expenses;
}

/** Six months of income and spending, the current month only up to today. */
function sampleCashflowTransactions(now: Date, currentMonthExpenses: PaceExpense[]): CashflowTransaction[] {
	const random = createRandom(4242);
	const transactions: CashflowTransaction[] = [];

	for (let offset = 5; offset >= 0; offset--) {
		const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
		const lastDay = getDaysInMonth(first.getFullYear(), first.getMonth() + 1);
		const paydays = [15, lastDay];

		for (const day of paydays) {
			const date = new Date(first.getFullYear(), first.getMonth(), day);
			if (date <= now) transactions.push({ date: toDateOnly(date), amount: 2500 });
		}

		if (offset === 0) {
			for (const expense of currentMonthExpenses) transactions.push({ date: expense.date, amount: -expense.amount });
		} else {
			const spent = 3100 + Math.round(random() * 900);
			transactions.push({ date: toDateOnly(new Date(first.getFullYear(), first.getMonth(), 10)), amount: -spent });
		}

		// A savings transfer every month, which the chart leaves out.
		transactions.push({
			date: toDateOnly(new Date(first.getFullYear(), first.getMonth(), 2)),
			amount: -500,
			source: "transfer",
		});
	}
	return transactions;
}

/** A front-loaded "usual month" (rent early), the shape `getHistoricalPace` returns with history. */
function sampleTypicalCurve(budget: number): number[] {
	return Array.from({ length: 31 }, (_, i) => Math.round(budget * Math.pow((i + 1) / 31, 0.7)));
}

export function samplePromotions(now: Date = getDemoNow()): HeadsUpPromotion[] {
	return [
		{
			id: "promo-sample-1",
			accountId: "acc-4",
			accountName: "Chase Sapphire Reserve",
			type: "spend_threshold",
			target: 4000,
			current: 2850,
			reward: "60,000 points",
			endDate: toDateOnly(daysBefore(now, -23)),
			isCompleted: false,
		},
	];
}

/**
 * Sample dashboard built through the same calculations as real data. `bills` comes from the
 * sample recurring list (see `getRecurringExpenses`) so the dashboard agrees with the Recurring page.
 */
export function getSampleDashboardData(now: Date = getDemoNow(), bills: BillInput[] = []): DashboardData {
	const today = toDateOnly(now);
	const accounts = sampleAccounts;

	const history = buildNetWorthSeries(
		accounts.map((a) => ({
			id: a.id,
			class: a.account_type.class === "liability" ? ("liability" as const) : ("asset" as const),
			balance: Number(a.current_balance),
		})),
		sampleBalanceRecords(now),
		today
	);
	const latest = history[history.length - 1];

	// The same month the Allocations demo shows, so both pages tell one story.
	const summary: AllocationSummary = getSmartMockData(now.getFullYear(), now.getMonth() + 1).summary;
	const budget = summary.summary.total_budget_caps;
	const expenses = sampleMonthExpenses(now, budget);

	return {
		today,
		netWorth: {
			current: latest.value,
			totalAssets: latest.assets,
			totalLiabilities: latest.liabilities,
			history,
		},
		accountsSummary: accounts.map((a) => ({
			id: a.id,
			name: a.name,
			institution: a.institution,
			typeName: a.account_type.name,
			class: a.account_type.class === "liability" ? "liability" : "asset",
			balance: Number(a.current_balance),
		})),
		monthPace: computeMonthPace({
			year: now.getFullYear(),
			month: now.getMonth() + 1,
			today,
			budget,
			expenses,
			typicalCurve: sampleTypicalCurve(budget),
		}),
		cashflow: buildMonthlyCashflow(sampleCashflowTransactions(now, expenses), today, 6),
		upcomingBills: selectUpcomingBills(bills, today),
		headsUp: buildHeadsUp({
			today,
			bills,
			categories: summary.categories.map((c) => ({
				id: c.id,
				name: c.name,
				budget: Number(c.budget_cap),
				spent: Number(c.actual_spend),
			})),
			promotions: samplePromotions(now),
		}),
		recentTransactions: getSampleRecentTransactions(now),
		accounts,
		categories: summary.categories,
	};
}

/** The same sample story the Dashboard tells, graded for the backdrop. */
export function getSampleWeatherInput(now: Date = getDemoNow(), bills: BillInput[] = []): WeatherInput {
	const data = getSampleDashboardData(now, bills);
	const expenses = sampleMonthExpenses(now, data.monthPace?.budget ?? 0);
	return {
		today: data.today,
		transactions: sampleCashflowTransactions(now, expenses)
			.filter((transaction) => !isTransfer(transaction))
			.map(({ date, amount }) => ({ date, amount })),
		monthPace: data.monthPace,
		netWorth: data.netWorth.history,
		...billsForWeather(bills, data.today),
		...accountsForWeather(sampleAccounts),
	};
}
