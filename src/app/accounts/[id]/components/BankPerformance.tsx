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

		const totalWithdrawals = transactions
			.filter((t) => t.transaction_type === "withdrawal")
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		const fees = -transactions.filter((t) => t.transaction_type === "fee").reduce((sum, t) => sum + t.amount, 0);

		const netCashFlow = totalDeposits - totalWithdrawals - fees;

		return {
			totalDeposits,
			totalWithdrawals,
			fees,
			netCashFlow,
		};
	}, [transactions]);

	return (
		<GlanceSection
			rows={[
				{ label: "Money in", value: formatCurrency(stats.totalDeposits), tone: "success" },
				{ label: "Money out", value: formatCurrency(stats.totalWithdrawals) },
				{ label: "Fees", value: formatCurrency(stats.fees), tone: stats.fees > 0 ? "error" : "muted" },
				{
					label: "Net flow",
					value: `${stats.netCashFlow >= 0 ? "+" : "-"}${formatCurrency(Math.abs(stats.netCashFlow))}`,
					tone: stats.netCashFlow >= 0 ? "success" : "error",
				},
			]}
		/>
	);
}
