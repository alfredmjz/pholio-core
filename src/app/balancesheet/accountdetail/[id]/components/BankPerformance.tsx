"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccountWithType, AccountTransaction } from "../../../types";

interface BankPerformanceProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

export function BankPerformance({ account, transactions, formatCurrency }: BankPerformanceProps) {
	const stats = useMemo(() => {
		// Deposits - Sum of deposits
		const totalDeposits = transactions
			.filter((t) => t.transaction_type === "deposit")
			.reduce((sum, t) => sum + t.amount, 0);

		// Withdrawals - Sum of withdrawals
		const withdrawalTransactions = transactions.filter((t) => t.transaction_type === "withdrawal");
		const totalWithdrawals = withdrawalTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		// Monthly Fees - Sum of withdrawals with 'fee' in description
		const monthlyFees = withdrawalTransactions
			.filter((t) => t.description?.toLowerCase().includes("fee"))
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		// Net Cash Flow = Deposits - Withdrawals (assuming pure inflow/outflow)
		// Or simplified: Just sum based on sign if stored signed, but 'withdrawal' implies negative direction.
		const netCashFlow = totalDeposits - totalWithdrawals;

		return {
			totalDeposits,
			totalWithdrawals,
			monthlyFees,
			netCashFlow,
		};
	}, [transactions]);

	return (
		<Card className="p-4">
			<h3 className="text-sm font-semibold text-primary mb-3">Performance</h3>
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Total Inflow (Deposits)</span>
					<span className="text-sm font-medium text-green-600 dark:text-green-400">
						{formatCurrency(stats.totalDeposits)}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Total Outflow (Withdrawals)</span>
					<span className="text-sm font-medium text-red-600 dark:text-red-400">
						{formatCurrency(stats.totalWithdrawals)}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Monthly Fees</span>
					<span className="text-sm font-medium text-red-600 dark:text-red-400">
						{formatCurrency(stats.monthlyFees)}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Net Cash Flow</span>
					<span
						className={cn(
							"text-sm font-medium",
							stats.netCashFlow >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
						)}
					>
						{stats.netCashFlow >= 0 ? "+" : "-"}
						{formatCurrency(Math.abs(stats.netCashFlow))}
					</span>
				</div>
			</div>
		</Card>
	);
}
