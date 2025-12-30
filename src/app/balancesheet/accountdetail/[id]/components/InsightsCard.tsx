"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccountWithType, AccountTransaction } from "../../../types";

interface InsightsCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	accountClass: "asset" | "liability" | undefined;
	formatCurrency: (amount: number) => string;
}

// Transaction type groupings with colors
const TRANSACTION_CATEGORIES = [
	{
		key: "contributions",
		label: "Contributions",
		types: ["deposit", "contribution"],
		color: "bg-cyan-500",
	},
	{
		key: "interest",
		label: "Interest Earned",
		types: ["interest"],
		color: "bg-pink-500",
	},
	{
		key: "withdrawals",
		label: "Withdrawals",
		types: ["withdrawal", "payment"],
		color: "bg-orange-500",
	},
	{
		key: "adjustments",
		label: "Adjustments",
		types: ["adjustment", "transfer"],
		color: "bg-purple-500",
	},
] as const;

export function InsightsCard({ account, transactions, accountClass, formatCurrency }: InsightsCardProps) {
	const stats = useMemo(() => {
		// Calculate amounts for each category
		const categoryStats = TRANSACTION_CATEGORIES.map((category) => {
			const amount = transactions
				.filter((t) => (category.types as readonly string[]).includes(t.transaction_type))
				.reduce((sum, t) => sum + t.amount, 0);
			return { ...category, amount };
		}).filter((cat) => cat.amount > 0); // Only show categories with transactions

		// Calculate total for percentages
		const total = categoryStats.reduce((sum, cat) => sum + cat.amount, 0);
		const withPercent = categoryStats.map((cat) => ({
			...cat,
			percent: total > 0 ? (cat.amount / total) * 100 : 0,
		}));

		// Calculate this month's change
		const now = new Date();
		const thisMonthTransactions = transactions.filter((t) => {
			const txDate = new Date(t.transaction_date);
			return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
		});
		const thisMonthChange = thisMonthTransactions.reduce((sum, t) => {
			if (t.transaction_type === "withdrawal" || t.transaction_type === "payment") {
				return sum - t.amount;
			}
			return sum + t.amount;
		}, 0);

		// Calculate time to goal (months)
		let monthsToGoal: number | null = null;
		if (account.target_balance && thisMonthChange > 0) {
			const remaining = account.target_balance - account.current_balance;
			if (remaining > 0) {
				monthsToGoal = Math.ceil(remaining / thisMonthChange);
			}
		}

		return {
			totalTransactions: transactions.length,
			categories: withPercent,
			thisMonthChange,
			monthsToGoal,
		};
	}, [transactions, account]);

	return (
		<Card className="p-6">
			<h3 className="text-base font-semibold mb-4">Insights and Metrics</h3>

			<div className="flex flex-col gap-6">
				{/* Transaction Count */}
				<div className="flex flex-col gap-2">
					<div className="text-3xl font-bold">{stats.totalTransactions}</div>
					<div className="text-sm text-primary">Total transactions</div>

					{/* Segmented Progress Bar */}
					{stats.categories.length > 0 && (
						<>
							<div className="h-2 bg-muted rounded-full overflow-hidden flex">
								{stats.categories.map((cat) => (
									<div key={cat.key} className={cn("h-full", cat.color)} style={{ width: `${cat.percent}%` }} />
								))}
							</div>

							{/* Legend */}
							<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
								{stats.categories.map((cat) => (
									<div key={cat.key} className="flex items-center gap-2">
										<div className={cn("w-2 h-2 rounded-full", cat.color)} />
										<span>{cat.label}</span>
										<span className="font-medium">{formatCurrency(cat.amount)}</span>
									</div>
								))}
							</div>
						</>
					)}
				</div>

				{/* Stats Row */}
				<div className="flex flex-wrap gap-8">
					<div className="flex flex-col gap-1">
						<div
							className={cn(
								"text-2xl font-bold",
								stats.thisMonthChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
							)}
						>
							{stats.thisMonthChange >= 0 ? "+" : ""}
							{formatCurrency(stats.thisMonthChange)}
						</div>
						<div className="text-sm text-primary">This month</div>
					</div>

					{stats.monthsToGoal !== null && (
						<div className="flex flex-col gap-1">
							<div className="text-2xl font-bold">{stats.monthsToGoal} months</div>
							<div className="text-sm text-primary">To goal</div>
						</div>
					)}

					{account.interest_rate && (
						<div className="flex flex-col gap-1">
							<div className="text-2xl font-bold">{(account.interest_rate * 100).toFixed(1)}%</div>
							<div className="text-sm text-primary">Current APY</div>
						</div>
					)}
				</div>
			</div>
		</Card>
	);
}
