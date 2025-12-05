"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
	TransactionType,
	TRANSACTION_TYPE_CONFIG,
	inferTransactionType,
} from "./TransactionTypeIcon";
import type { Transaction } from "../../types";

interface SpendingByTypeProps {
	transactions: Transaction[];
	onTypeFilter: (type: TransactionType | null) => void;
	activeFilter: TransactionType | null;
}

interface TypeBreakdown {
	type: TransactionType;
	amount: number;
	count: number;
	percentage: number;
}

export function SpendingByType({
	transactions,
	onTypeFilter,
	activeFilter,
}: SpendingByTypeProps) {
	// Calculate spending breakdown by type
	const breakdown = useMemo(() => {
		const totals: Record<TransactionType, { amount: number; count: number }> = {
			recurring: { amount: 0, count: 0 },
			one_time: { amount: 0, count: 0 },
			loan: { amount: 0, count: 0 },
			subscription: { amount: 0, count: 0 },
			interest: { amount: 0, count: 0 },
			investment: { amount: 0, count: 0 },
			income: { amount: 0, count: 0 },
			transfer: { amount: 0, count: 0 },
		};

		transactions.forEach((t) => {
			const type = inferTransactionType(t);
			// Only count expenses (negative amounts or positive for spending)
			const amount = Math.abs(t.amount);
			totals[type].amount += amount;
			totals[type].count += 1;
		});

		const totalSpending = Object.values(totals).reduce((sum, t) => sum + t.amount, 0);

		// Filter out types with no transactions and sort by amount
		const result: TypeBreakdown[] = Object.entries(totals)
			.filter(([_, data]) => data.count > 0)
			.map(([type, data]) => ({
				type: type as TransactionType,
				amount: data.amount,
				count: data.count,
				percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
			}))
			.sort((a, b) => b.amount - a.amount);

		return result;
	}, [transactions]);

	const totalSpending = breakdown.reduce((sum, b) => sum + b.amount, 0);

	if (breakdown.length === 0) {
		return (
			<Card className="p-6">
				<h3 className="text-sm font-semibold text-foreground mb-4">
					Spending by Type
				</h3>
				<p className="text-sm text-muted-foreground text-center py-8">
					No transactions this month
				</p>
			</Card>
		);
	}

	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-foreground">
					Spending by Type
				</h3>
				{activeFilter && (
					<button
						onClick={() => onTypeFilter(null)}
						className="text-xs text-info hover:text-info/80 transition-colors"
					>
						Clear filter
					</button>
				)}
			</div>

			{/* Stacked bar visualization */}
			<div className="h-4 rounded-full overflow-hidden flex mb-4 bg-muted">
				{breakdown.map((item) => {
					const config = TRANSACTION_TYPE_CONFIG[item.type];
					return (
						<div
							key={item.type}
							className={cn(
								"h-full transition-all duration-300 cursor-pointer hover:opacity-80",
								config.bgColor,
								activeFilter === item.type && "ring-2 ring-info ring-offset-1"
							)}
							style={{ width: `${item.percentage}%` }}
							onClick={() => onTypeFilter(activeFilter === item.type ? null : item.type)}
							title={`${config.label}: $${item.amount.toFixed(0)} (${item.percentage.toFixed(1)}%)`}
						/>
					);
				})}
			</div>

			{/* Legend with amounts */}
			<div className="space-y-2">
				{breakdown.map((item) => {
					const config = TRANSACTION_TYPE_CONFIG[item.type];
					const Icon = config.icon;
					const isActive = activeFilter === item.type;

					return (
						<button
							key={item.type}
							onClick={() => onTypeFilter(isActive ? null : item.type)}
							className={cn(
								"w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all",
								"hover:bg-muted/50",
								isActive && "bg-muted ring-1 ring-info"
							)}
						>
							<div className="flex items-center gap-3">
								<div className={cn("p-1.5 rounded-md", config.bgColor)}>
									<Icon className={cn("h-4 w-4", config.textColor)} />
								</div>
								<div className="text-left">
									<div className="text-sm font-medium text-foreground">
										{config.label}
									</div>
									<div className="text-xs text-muted-foreground">
										{item.count} {item.count === 1 ? "transaction" : "transactions"}
									</div>
								</div>
							</div>
							<div className="text-right">
								<div className="text-sm font-semibold text-foreground">
									${item.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
								</div>
								<div className="text-xs text-muted-foreground">
									{item.percentage.toFixed(1)}%
								</div>
							</div>
						</button>
					);
				})}
			</div>

			{/* Total */}
			<div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
				<span className="text-sm font-medium text-muted-foreground">Total Spending</span>
				<span className="text-lg font-bold text-foreground">
					${totalSpending.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
				</span>
			</div>
		</Card>
	);
}
