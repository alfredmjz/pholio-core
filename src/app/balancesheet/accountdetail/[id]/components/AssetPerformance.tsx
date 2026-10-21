"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { parseLocalDate } from "@/lib/date-utils";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
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

		const isInvestment = isInvestmentAccount(account);

		return {
			interestEarned,
			totalDeposits,
			totalWithdrawals,
			monthlyInterestEstimate,
			annualGrowthRate,
			isInvestment,
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
			</div>
		</Card>
	);
}
