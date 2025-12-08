"use server";

import { createClient } from "@/lib/supabase/server";
import type { DashboardData, CashflowSummary, AllCashflowData, NetWorthData, Transaction, Period } from "./types";

/**
 * Fetch all dashboard data for the current user
 */
export async function getDashboardData(): Promise<DashboardData> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		// Return empty dashboard data for unauthenticated users
		return getEmptyDashboardData();
	}

	// For now, return mock data since the accounts table isn't set up yet
	// TODO: Replace with actual database queries once migration is applied
	return getMockDashboardData();
}

/**
 * Fetch cashflow data for a specific period
 */
export async function getCashflowData(period: Period): Promise<CashflowSummary> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return getEmptyCashflowData(period);
	}

	// TODO: Implement actual cashflow query
	// For now, return mock data
	return getMockCashflowData(period);
}

/**
 * Fetch net worth data
 */
export async function getNetWorthData(): Promise<NetWorthData> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return getEmptyNetWorthData();
	}

	// TODO: Implement actual net worth query
	// For now, return mock data
	return getMockNetWorthData();
}

/**
 * Fetch recent transactions
 */
export async function getRecentTransactions(limit: number = 10): Promise<Transaction[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return [];
	}

	// Query actual transactions from the database
	const { data: transactions, error } = await supabase
		.from("transactions")
		.select(
			`
			id,
			name,
			amount,
			transaction_date,
			allocation_categories (
				name,
				color
			)
		`
		)
		.eq("user_id", user.id)
		.order("transaction_date", { ascending: false })
		.limit(limit);

	if (error || !transactions) {
		console.error("Error fetching transactions:", error);
		return getMockTransactions();
	}

	return transactions.map((t: any) => ({
		id: t.id,
		date: t.transaction_date,
		description: t.name,
		category: t.allocation_categories?.name || "Uncategorized",
		amount: Math.abs(t.amount),
		type: t.amount >= 0 ? ("income" as const) : ("expense" as const),
	}));
}

// ============================================================================
// Helper Functions - Empty Data
// ============================================================================

function getEmptyDashboardData(): DashboardData {
	return {
		metrics: {
			netWorth: { label: "Net Worth", value: 0 },
			monthlyIncome: { label: "Monthly Income", value: 0 },
			monthlyExpenses: { label: "Monthly Expenses", value: 0 },
			savingsRate: { label: "Savings Rate", value: 0 },
		},
		cashflow: getEmptyAllCashflowData(),
		netWorth: getEmptyNetWorthData(),
		recentTransactions: [],
	};
}

function getEmptyCashflowData(period: Period): CashflowSummary {
	return {
		totalIncome: 0,
		totalExpenses: 0,
		netCashflow: 0,
		period,
		data: [],
	};
}

function getEmptyAllCashflowData(): AllCashflowData {
	return {
		month: getEmptyCashflowData("month"),
		quarter: getEmptyCashflowData("quarter"),
		year: getEmptyCashflowData("year"),
	};
}

function getEmptyNetWorthData(): NetWorthData {
	return {
		netWorth: 0,
		totalAssets: 0,
		totalLiabilities: 0,
		assetBreakdown: [],
		liabilityBreakdown: [],
		trendData: [],
	};
}

// ============================================================================
// Helper Functions - Mock Data (for development/demo)
// ============================================================================

function getMockDashboardData(): DashboardData {
	return {
		metrics: {
			netWorth: {
				label: "Net Worth",
				value: 125000,
				trend: { value: 3.2, direction: "up", period: "vs last month" },
			},
			monthlyIncome: {
				label: "Monthly Income",
				value: 8500,
				trend: { value: 5.1, direction: "up", period: "vs last month" },
			},
			monthlyExpenses: {
				label: "Monthly Expenses",
				value: 5200,
				trend: { value: -2.3, direction: "up", period: "vs last month" },
			},
			savingsRate: {
				label: "Savings Rate",
				value: 3300,
				trend: { value: 8.5, direction: "up", period: "vs last month" },
			},
		},
		cashflow: getAllMockCashflowData(),
		netWorth: getMockNetWorthData(),
		recentTransactions: getMockTransactions(),
	};
}

function getMockCashflowData(period: Period): CashflowSummary {
	const monthlyData = [
		{ date: "2024-07-01", label: "Jul", income: 8200, expenses: 5100 },
		{ date: "2024-08-01", label: "Aug", income: 8500, expenses: 5400 },
		{ date: "2024-09-01", label: "Sep", income: 8300, expenses: 4900 },
		{ date: "2024-10-01", label: "Oct", income: 8700, expenses: 5600 },
		{ date: "2024-11-01", label: "Nov", income: 8400, expenses: 5200 },
		{ date: "2024-12-01", label: "Dec", income: 8500, expenses: 5200 },
	];

	const quarterlyData = [
		{ date: "2024-Q1", label: "Q1 2024", income: 24500, expenses: 15200 },
		{ date: "2024-Q2", label: "Q2 2024", income: 25800, expenses: 16100 },
		{ date: "2024-Q3", label: "Q3 2024", income: 25000, expenses: 15400 },
		{ date: "2024-Q4", label: "Q4 2024", income: 25600, expenses: 16000 },
	];

	const yearlyData = [
		{ date: "2022", label: "2022", income: 92000, expenses: 58000 },
		{ date: "2023", label: "2023", income: 98000, expenses: 61000 },
		{ date: "2024", label: "2024", income: 100900, expenses: 62700 },
	];

	const dataMap = {
		month: monthlyData,
		quarter: quarterlyData,
		year: yearlyData,
	};

	const data = dataMap[period];
	const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
	const totalExpenses = data.reduce((sum, d) => sum + d.expenses, 0);

	return {
		totalIncome,
		totalExpenses,
		netCashflow: totalIncome - totalExpenses,
		period,
		data,
	};
}

function getAllMockCashflowData(): AllCashflowData {
	return {
		month: getMockCashflowData("month"),
		quarter: getMockCashflowData("quarter"),
		year: getMockCashflowData("year"),
	};
}

function getMockNetWorthData(): NetWorthData {
	return {
		netWorth: 125000,
		totalAssets: 185000,
		totalLiabilities: 60000,
		trend: { value: 3.2, direction: "up", period: "vs last month" },
		assetBreakdown: [
			{
				category: "Banking",
				value: 25000,
				accounts: [
					{ name: "TD Chequing", value: 5000 },
					{ name: "TD Savings", value: 15000 },
					{ name: "EQ Bank HISA", value: 5000 },
				],
			},
			{
				category: "Investment",
				value: 45000,
				accounts: [
					{ name: "Wealthsimple", value: 30000 },
					{ name: "Questrade", value: 15000 },
				],
			},
			{
				category: "Retirement",
				value: 80000,
				accounts: [
					{ name: "TFSA", value: 45000 },
					{ name: "RRSP", value: 35000 },
				],
			},
			{
				category: "Property",
				value: 35000,
				accounts: [{ name: "Vehicle", value: 35000 }],
			},
		],
		liabilityBreakdown: [
			{
				category: "Credit",
				value: 5000,
				accounts: [
					{ name: "TD Visa", value: 2500 },
					{ name: "Amex", value: 2500 },
				],
			},
			{
				category: "Debt",
				value: 55000,
				accounts: [
					{ name: "Car Loan", value: 25000 },
					{ name: "Line of Credit", value: 30000 },
				],
			},
		],
		trendData: [
			{ date: "Jul", value: 115000 },
			{ date: "Aug", value: 118000 },
			{ date: "Sep", value: 120000 },
			{ date: "Oct", value: 119000 },
			{ date: "Nov", value: 122000 },
			{ date: "Dec", value: 125000 },
		],
	};
}

function getMockTransactions(): Transaction[] {
	return [
		{
			id: "1",
			date: "2024-12-05",
			description: "Monthly Salary",
			category: "Income",
			amount: 8500,
			type: "income",
		},
		{
			id: "2",
			date: "2024-12-04",
			description: "Loblaws Groceries",
			category: "Groceries",
			amount: 156.78,
			type: "expense",
		},
		{
			id: "3",
			date: "2024-12-03",
			description: "Netflix Subscription",
			category: "Entertainment",
			amount: 16.99,
			type: "expense",
		},
		{
			id: "4",
			date: "2024-12-02",
			description: "Petro-Canada",
			category: "Transportation",
			amount: 85.5,
			type: "expense",
		},
		{
			id: "5",
			date: "2024-12-01",
			description: "Rogers Internet",
			category: "Utilities",
			amount: 89.99,
			type: "expense",
		},
		{
			id: "6",
			date: "2024-11-30",
			description: "Side Project Payment",
			category: "Income",
			amount: 500,
			type: "income",
		},
		{
			id: "7",
			date: "2024-11-29",
			description: "Tim Hortons",
			category: "Dining",
			amount: 12.45,
			type: "expense",
		},
		{
			id: "8",
			date: "2024-11-28",
			description: "Amazon Purchase",
			category: "Shopping",
			amount: 67.89,
			type: "expense",
		},
	];
}
