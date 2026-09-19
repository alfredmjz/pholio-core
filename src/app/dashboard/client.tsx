"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MetricCard } from "./components/MetricCard";
import { CashflowWidget } from "./components/CashflowWidget";
import { NetWorthWidget } from "./components/NetWorthWidget";
import { RecentTransactions } from "./components/RecentTransactions";
import { AddAccountDialog } from "@/app/balancesheet/components/AddAccountDialog";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";
import { TrendingUp, Wallet, CreditCard, PiggyBank } from "lucide-react";
import type { DashboardData, Period, ChartType } from "./types";
import { getDashboardData } from "./actions";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";

interface DashboardClientProps {
	initialData: DashboardData;
}

export function DashboardClient({ initialData }: DashboardClientProps) {
	const router = useRouter();

	const { data } = useServerSyncedData<DashboardData>(initialData, () => getDashboardData());

	const [cashflowPeriod, setCashflowPeriod] = useState<Period>("month");
	const [netWorthChartType, setNetWorthChartType] = useState<ChartType>("donut");

	// Dialog states for empty state actions
	const [addAccountOpen, setAddAccountOpen] = useState(false);
	const [addTransactionOpen, setAddTransactionOpen] = useState(false);

	const cashflowData = data.cashflow[cashflowPeriod];

	const handlePeriodChange = (period: Period) => {
		setCashflowPeriod(period);
	};

	const handleViewAllTransactions = () => {
		router.push("/allocations");
	};

	const handleAddAccountSuccess = () => {
		setAddAccountOpen(false);
		router.refresh();
	};

	const handleAddTransactionSuccess = () => {
		setAddTransactionOpen(false);
		router.refresh();
	};

	return (
		<>
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h1>
					<p className="text-sm text-primary mt-1">Your financial overview at a glance</p>
				</div>
			</div>

			{/* Financial Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard
					label="Net Worth"
					value={data.metrics.netWorth.value}
					trend={data.metrics.netWorth.trend}
					icon={<TrendingUp className="h-4 w-4" />}
					variant="success"
				/>
				<MetricCard
					label="Monthly Income"
					value={data.metrics.monthlyIncome.value}
					trend={data.metrics.monthlyIncome.trend}
					icon={<Wallet className="h-4 w-4" />}
					variant="info"
				/>
				<MetricCard
					label="Monthly Expenses"
					value={data.metrics.monthlyExpenses.value}
					trend={data.metrics.monthlyExpenses.trend}
					icon={<CreditCard className="h-4 w-4" />}
					variant="error"
				/>
				<MetricCard
					label="Monthly Savings"
					value={data.metrics.savingsRate.value}
					trend={data.metrics.savingsRate.trend}
					icon={<PiggyBank className="h-4 w-4" />}
					variant={data.metrics.savingsRate.value >= 0 ? "success" : "warning"}
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
					onAddTransaction={() => setAddTransactionOpen(true)}
				/>
				<NetWorthWidget
					netWorth={data.netWorth.netWorth}
					totalAssets={data.netWorth.totalAssets}
					totalLiabilities={data.netWorth.totalLiabilities}
					trend={data.netWorth.trend}
					assetBreakdown={data.netWorth.assetBreakdown}
					liabilityBreakdown={data.netWorth.liabilityBreakdown}
					trendData={data.netWorth.trendData}
					chartType={netWorthChartType}
					onChartTypeChange={setNetWorthChartType}
					onAddAccount={() => setAddAccountOpen(true)}
				/>
			</div>

			{/* Recent Transactions */}
			<RecentTransactions transactions={data.recentTransactions} onViewAll={handleViewAllTransactions} />

			{/* Dialogs for empty state actions */}
			<AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} onSuccess={handleAddAccountSuccess} />
			<UnifiedTransactionDialog
				open={addTransactionOpen}
				onOpenChange={setAddTransactionOpen}
				categories={data.categories ?? []}
				accounts={data.accounts ?? []}
				onSuccess={handleAddTransactionSuccess}
			/>
		</>
	);
}
