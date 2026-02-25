"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { parseLocalDate } from "@/lib/date-utils";
import type { AccountWithType, AccountTransaction } from "../../../types";

interface AssetPerformanceProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

export function AssetPerformance({ account, transactions, formatCurrency }: AssetPerformanceProps) {
	const stats = useMemo(() => {
		const interestEarned = transactions
			.filter((t) => t.transaction_type === "interest")
			.reduce((sum, t) => sum + t.amount, 0);

		const totalDeposits = transactions
			.filter((t) => t.transaction_type === "deposit" || t.transaction_type === "contribution")
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		const totalWithdrawals = transactions
			.filter((t) => t.transaction_type === "withdrawal")
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		const monthlyInterestEstimate =
			account.interest_rate && account.current_balance ? account.current_balance * (account.interest_rate / 12) : 0;

		// Calculate actual growth rate based on interest recorded this month
		const now = new Date();
		const thisMonthInterest = transactions
			.filter((t) => {
				const d = parseLocalDate(t.transaction_date);
				return (
					t.transaction_type === "interest" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
				);
			})
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		const annualGrowthRate = account.current_balance > 0 ? (thisMonthInterest * 12) / account.current_balance : 0;

		// Calculate Contributions for warnings
		const thisYearContributions = transactions
			.filter((t) => {
				const d = parseLocalDate(t.transaction_date);
				return (
					(t.transaction_type === "deposit" || t.transaction_type === "contribution") &&
					d.getFullYear() === now.getFullYear()
				);
			})
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		const isInvestment =
			account.account_type?.category === "investment" || account.account_type?.category === "retirement";

		// Warning Logic
		let annualLimitWarning: "approaching" | "exceeded" | null = null;
		let totalRoomWarning: "approaching" | "exceeded" | null = null;

		if (isInvestment && account.track_contribution_room) {
			if (account.annual_contribution_limit) {
				if (thisYearContributions > account.annual_contribution_limit) {
					annualLimitWarning = "exceeded";
				} else if (thisYearContributions >= account.annual_contribution_limit * 0.9) {
					annualLimitWarning = "approaching";
				}
			}

			// For total room, we check if current balance (or total deposits) exceeds the total room.
			// Usually, "Contribution Room" is a hard limit on total *contributions* across all time, not balance.
			// Since we only have 'totalDeposits' tracked in the app's history, we'll use that.
			if (account.contribution_room) {
				if (totalDeposits > account.contribution_room) {
					totalRoomWarning = "exceeded";
				} else if (totalDeposits >= account.contribution_room * 0.9) {
					totalRoomWarning = "approaching";
				}
			}
		}

		return {
			interestEarned,
			totalDeposits,
			totalWithdrawals,
			monthlyInterestEstimate,
			annualGrowthRate,
			isInvestment,
			thisYearContributions,
			annualLimitWarning,
			totalRoomWarning,
		};
	}, [transactions, account]);

	return (
		<Card className="p-4">
			<h3 className="text-sm font-semibold text-primary mb-3">Performance</h3>
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Total Deposits</span>
					<span className="text-sm font-medium text-green-600 dark:text-green-400">
						{formatCurrency(stats.totalDeposits)}
					</span>
				</div>
				{stats.isInvestment && (
					<div className="flex items-center justify-between">
						<span className="text-sm text-primary">Total Withdrawals</span>
						<span className="text-sm font-medium text-red-600 dark:text-red-400">
							{formatCurrency(stats.totalWithdrawals)}
						</span>
					</div>
				)}

				{!stats.isInvestment && (
					<>
						<div className="flex items-center justify-between">
							<span className="text-sm text-primary">Yield (Interest)</span>
							<span className="text-sm font-medium text-green-600 dark:text-green-400">
								{formatCurrency(stats.interestEarned)}
							</span>
						</div>
						<div className="flex items-center justify-between pt-2 border-t border-border/50">
							<span className="text-sm text-primary font-medium">Annual Growth Rate</span>
							<span className="text-sm font-bold text-green-600 dark:text-green-400">
								{stats.annualGrowthRate > 0 ? `${(stats.annualGrowthRate * 100).toFixed(2)}%` : "0.00%"}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-primary italic">Est. Monthly Interest</span>
							<span className="text-sm font-medium text-muted-foreground">
								{formatCurrency(stats.monthlyInterestEstimate)}
							</span>
						</div>
					</>
				)}

				{stats.isInvestment && account.track_contribution_room && (
					<>
						<div className="flex flex-col gap-1 pt-2 border-t border-border/50">
							<div className="flex items-center justify-between">
								<span className="text-sm text-primary font-medium">Annual Limit</span>
								<div className="flex flex-col items-end">
									<span className="text-sm font-medium text-muted-foreground">
										{account.annual_contribution_limit ? formatCurrency(account.annual_contribution_limit) : "Not Set"}
									</span>
								</div>
							</div>
							{stats.annualLimitWarning === "exceeded" && (
								<div className="flex items-center gap-1.5 text-xs text-red-500 mt-1">
									<AlertCircle className="w-3.5 h-3.5" />
									<span>
										Annual limit exceeded by{" "}
										{formatCurrency(stats.thisYearContributions - (account.annual_contribution_limit || 0))}!
									</span>
								</div>
							)}
							{stats.annualLimitWarning === "approaching" && (
								<div className="flex items-center gap-1.5 text-xs text-amber-500 mt-1">
									<AlertTriangle className="w-3.5 h-3.5" />
									<span>Approaching annual limit ({formatCurrency(stats.thisYearContributions)} contributed)</span>
								</div>
							)}
						</div>

						<div className="flex flex-col gap-1">
							<div className="flex items-center justify-between">
								<span className="text-sm text-primary">Total Contribution Room</span>
								<span className="text-sm font-medium">
									{account.contribution_room ? formatCurrency(account.contribution_room) : "Not Set"}
								</span>
							</div>
							{stats.totalRoomWarning === "exceeded" && (
								<div className="flex items-center gap-1.5 text-xs text-red-500 mt-1">
									<AlertCircle className="w-3.5 h-3.5" />
									<span>Total contribution room exceeded!</span>
								</div>
							)}
							{stats.totalRoomWarning === "approaching" && (
								<div className="flex items-center gap-1.5 text-xs text-amber-500 mt-1">
									<AlertTriangle className="w-3.5 h-3.5" />
									<span>Approaching total contribution limit.</span>
								</div>
							)}
						</div>
					</>
				)}
			</div>
		</Card>
	);
}

