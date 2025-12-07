/**
 * Dashboard Types
 * Defines all TypeScript interfaces for dashboard data structures
 */

export type Period = "month" | "quarter" | "year";

export type ChartType = "donut" | "trend";

export type TrendDirection = "up" | "down" | "neutral";

export interface Trend {
	value: number;
	direction: TrendDirection;
	period: string; // e.g., "vs last month"
}

export interface MetricCardData {
	label: string;
	value: number;
	trend?: Trend;
	icon?: React.ComponentType<{ className?: string }>;
	variant?: "default" | "success" | "error" | "warning" | "info";
}

export interface CashflowDataPoint {
	date: string; // YYYY-MM-DD or YYYY-MM or YYYY
	label: string; // e.g., "Jan", "Q1", "2024"
	income: number;
	expenses: number;
}

export interface CashflowSummary {
	totalIncome: number;
	totalExpenses: number;
	netCashflow: number;
	period: Period;
	data: CashflowDataPoint[];
}

export interface AssetBreakdown {
	category: string;
	value: number;
	accounts: {
		name: string;
		value: number;
	}[];
}

export interface LiabilityBreakdown {
	category: string;
	value: number;
	accounts: {
		name: string;
		value: number;
	}[];
}

export interface NetWorthData {
	netWorth: number;
	totalAssets: number;
	totalLiabilities: number;
	trend?: Trend;
	assetBreakdown: AssetBreakdown[];
	liabilityBreakdown: LiabilityBreakdown[];
	trendData?: {
		date: string;
		value: number;
	}[];
}

export interface Transaction {
	id: string;
	date: string;
	description: string;
	category: string;
	amount: number;
	type: "income" | "expense";
	account?: string;
}

export interface DashboardData {
	metrics: {
		netWorth: MetricCardData;
		monthlyIncome: MetricCardData;
		monthlyExpenses: MetricCardData;
		savingsRate: MetricCardData;
	};
	cashflow: CashflowSummary;
	netWorth: NetWorthData;
	recentTransactions: Transaction[];
}
