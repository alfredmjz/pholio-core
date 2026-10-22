"use client";

import { useMemo } from "react";
import type { AccountWithType, AccountTransaction } from "../../types";
import { GlanceSection } from "./PerformanceCard";

interface BankPerformanceProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

export function BankPerformance({ account, transactions, formatCurrency }: BankPerformanceProps) {
	const stats = useMemo(() => {
		const totalDeposits = transactions
			.filter((t) => t.transaction_type === "deposit")
			.reduce((sum, t) => sum + t.amount, 0);

		const withdrawalTransactions = transactions.filter((t) => t.transaction_type === "withdrawal");
		const totalWithdrawals = withdrawalTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		const monthlyFees = withdrawalTransactions
			.filter((t) => t.description?.toLowerCase().includes("fee"))
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		const netCashFlow = totalDeposits - totalWithdrawals;

		return {
			totalDeposits,
			totalWithdrawals,
			monthlyFees,
			netCashFlow,
		};
	}, [transactions]);

	return (
		<GlanceSection
			rows={[
				{ label: "Money in", value: formatCurrency(stats.totalDeposits), tone: "success" },
				{ label: "Money out", value: formatCurrency(stats.totalWithdrawals) },
				{ label: "Fees", value: formatCurrency(stats.monthlyFees), tone: stats.monthlyFees > 0 ? "error" : "muted" },
				{
					label: "Net flow",
					value: `${stats.netCashFlow >= 0 ? "+" : "-"}${formatCurrency(Math.abs(stats.netCashFlow))}`,
					tone: stats.netCashFlow >= 0 ? "success" : "error",
				},
			]}
		/>
	);
}
