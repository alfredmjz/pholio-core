"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MetricCard } from "./components/MetricCard";
import { CashflowWidget } from "./components/CashflowWidget";
import { NetWorthWidget } from "./components/NetWorthWidget";
import { RecentTransactions } from "./components/RecentTransactions";
import {
	TrendingUp,
	Wallet,
	CreditCard,
	PiggyBank,
} from "lucide-react";
import type { DashboardData, Period, ChartType } from "./types";

interface DashboardClientProps {
	initialData: DashboardData;
}

export function DashboardClient({ initialData }: DashboardClientProps) {
	const router = useRouter();
	const [cashflowPeriod, setCashflowPeriod] = useState<Period>("month");
	const [netWorthChartType, setNetWorthChartType] = useState<ChartType>("donut");

	// Initialize with the month data, but we have all data available in initialData.cashflow
	const [cashflowData, setCashflowData] = useState(initialData.cashflow.month);

	const handlePeriodChange = (period: Period) => {
		setCashflowPeriod(period);
		// Instantly switch data from the pre-fetched object
		setCashflowData(initialData.cashflow[period]);
	};

	const handleViewAllTransactions = () => {
		router.push("/allocations");
	};

	return (
		<>
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">
						Dashboard
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Your financial overview at a glance
					</p>
				</div>
			</div>

			{/* Financial Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard
					label="Net Worth"
					value={initialData.metrics.netWorth.value}
					trend={initialData.metrics.netWorth.trend}
					icon={<TrendingUp className="h-4 w-4" />}
					variant="success"
				/>
				<MetricCard
					label="Monthly Income"
					value={initialData.metrics.monthlyIncome.value}
					trend={initialData.metrics.monthlyIncome.trend}
					icon={<Wallet className="h-4 w-4" />}
					variant="info"
				/>
				<MetricCard
					label="Monthly Expenses"
					value={initialData.metrics.monthlyExpenses.value}
					trend={initialData.metrics.monthlyExpenses.trend}
					icon={<CreditCard className="h-4 w-4" />}
					variant="error"
				/>
				<MetricCard
					label="Monthly Savings"
					value={initialData.metrics.savingsRate.value}
					trend={initialData.metrics.savingsRate.trend}
					icon={<PiggyBank className="h-4 w-4" />}
					variant={
						initialData.metrics.savingsRate.value >= 0 ? "success" : "warning"
					}
				/>
			</div>

			{/* Primary Widgets Row */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<CashflowWidget
					data={cashflowData.data}
					totalIncome={cashflowData.totalIncome}
					totalExpenses={cashflowData.totalExpenses}
					netCashflow={cashflowData.netCashflow}
					selectedPeriod={cashflowPeriod}
					onPeriodChange={handlePeriodChange}
				/>
				<NetWorthWidget
					netWorth={initialData.netWorth.netWorth}
					totalAssets={initialData.netWorth.totalAssets}
					totalLiabilities={initialData.netWorth.totalLiabilities}
					trend={initialData.netWorth.trend}
					assetBreakdown={initialData.netWorth.assetBreakdown}
					liabilityBreakdown={initialData.netWorth.liabilityBreakdown}
					trendData={initialData.netWorth.trendData}
					chartType={netWorthChartType}
					onChartTypeChange={setNetWorthChartType}
				/>
			</div>

			{/* Recent Transactions */}
			<RecentTransactions
				transactions={initialData.recentTransactions}
				onViewAll={handleViewAllTransactions}
			/>
		</>
	);
}
