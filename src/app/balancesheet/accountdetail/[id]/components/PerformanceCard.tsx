"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccountWithType, AccountTransaction } from "../../../types";

interface PerformanceCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

export function PerformanceCard({ account, transactions, formatCurrency }: PerformanceCardProps) {
	const stats = useMemo(() => {
		const interestEarned = transactions
			.filter((t) => t.transaction_type === "interest")
			.reduce((sum, t) => sum + t.amount, 0);

		const contributions = transactions.filter(
			(t) => t.transaction_type === "deposit" || t.transaction_type === "contribution"
		);
		const avgContribution =
			contributions.length > 0 ? contributions.reduce((sum, t) => sum + t.amount, 0) / contributions.length : 0;

		const growthRate = account.percent_change ?? 0;

		return {
			interestEarned,
			avgContribution,
			growthRate,
		};
	}, [transactions, account]);

	return (
		<Card className="p-4">
			<h3 className="text-sm font-semibold text-muted-foreground mb-3">Performance</h3>
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-sm text-muted-foreground">Interest Earned</span>
					<span className="text-sm font-medium">{formatCurrency(stats.interestEarned)}</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-muted-foreground">Avg. Contribution</span>
					<span className="text-sm font-medium">{formatCurrency(stats.avgContribution)}</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-muted-foreground">Growth Rate</span>
					<span
						className={cn(
							"text-sm font-medium",
							stats.growthRate >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
						)}
					>
						{stats.growthRate >= 0 ? "+" : ""}
						{stats.growthRate.toFixed(1)}%
					</span>
				</div>
			</div>
		</Card>
	);
}
