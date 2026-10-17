import { DashboardData, Transaction } from "@/app/dashboard/types";
import { getDemoNow, daysBefore, monthsBefore, toDateOnly } from "./demo-date";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function summarize(data: Array<{ income: number; expenses: number }>) {
	const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
	const totalExpenses = data.reduce((sum, d) => sum + d.expenses, 0);
	return { totalIncome, totalExpenses, netCashflow: totalIncome - totalExpenses };
}

export function getSampleDashboardData(now: Date = getDemoNow()): DashboardData {
	const year = now.getFullYear();
	const monthIndex = now.getMonth();

	// Month view: four weekly points in the current month.
	const monthData = [
		{ day: 1, label: "Week 1", income: 2000, expenses: 1000 },
		{ day: 8, label: "Week 2", income: 2100, expenses: 1200 },
		{ day: 15, label: "Week 3", income: 2200, expenses: 900 },
		{ day: 22, label: "Week 4", income: 2200, expenses: 1100 },
	].map((w) => ({
		date: toDateOnly(new Date(year, monthIndex, w.day)),
		label: w.label,
		income: w.income,
		expenses: w.expenses,
	}));

	// Quarter view: the current month and the two before it.
	const quarterData = [2, 1, 0].map((offset) => {
		const d = monthsBefore(now, offset);
		const m = d.getMonth();
		return {
			date: `${d.getFullYear()}-${String(m + 1).padStart(2, "0")}`,
			label: MONTH_LABELS[m],
			income: [8200, 8300, 8500][2 - offset],
			expenses: [4000, 4400, 4200][2 - offset],
		};
	});

	// Year view: current year and the two before it.
	const yearData = [2, 1, 0].map((offset) => {
		const y = year - offset;
		return {
			date: String(y),
			label: String(y),
			income: [98000, 100900, 102000][2 - offset],
			expenses: [45000, 48000, 50000][2 - offset],
		};
	});

	const trendData = [5, 4, 3, 2, 1, 0].map((offset) => {
		const d = monthsBefore(now, offset);
		return {
			date: MONTH_LABELS[d.getMonth()],
			value: 110000 + (5 - offset) * 3000,
		};
	});

	return {
		metrics: {
			netWorth: {
				label: "Net Worth",
				value: 125000,
				trend: { value: 5.2, direction: "up", period: "vs last month" },
				variant: "default",
			},
			monthlyIncome: {
				label: "Monthly Income",
				value: 8500,
				trend: { value: 2.1, direction: "up", period: "vs last month" },
				variant: "success",
			},
			monthlyExpenses: {
				label: "Monthly Expenses",
				value: 4200,
				trend: { value: 1.5, direction: "down", period: "vs last month" },
				variant: "default",
			},
			savingsRate: {
				label: "Savings Rate",
				value: 50.5,
				trend: { value: 3.2, direction: "up", period: "vs last month" },
				variant: "success",
			},
		},
		cashflow: {
			month: { ...summarize(monthData), period: "month", data: monthData },
			quarter: { ...summarize(quarterData), period: "quarter", data: quarterData },
			year: { ...summarize(yearData), period: "year", data: yearData },
		},
		netWorth: {
			netWorth: 125000,
			totalAssets: 150000,
			totalLiabilities: 25000,
			trend: { value: 12, direction: "up", period: "vs last year" },
			assetBreakdown: [
				{
					category: "Cash & Equivalents",
					value: 30000,
					accounts: [
						{ name: "Checking Account", value: 5000 },
						{ name: "Savings Account", value: 25000 },
					],
				},
				{
					category: "Investments",
					value: 120000,
					accounts: [
						{ name: "401k", value: 80000 },
						{ name: "Roth IRA", value: 20000 },
						{ name: "Brokerage", value: 20000 },
					],
				},
			],
			liabilityBreakdown: [
				{
					category: "Loans",
					value: 25000,
					accounts: [
						{ name: "Student Loan", value: 15000 },
						{ name: "Car Loan", value: 10000 },
					],
				},
			],
			trendData,
		},
		recentTransactions: getSampleRecentTransactions(now),
	};
}
