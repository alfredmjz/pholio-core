"use client";

import { useMemo } from "react";
import { parseLocalDate } from "@/lib/date-utils";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
import { summarizeInvestmentFlows } from "@/lib/investment-balance";
import type { AccountWithType, AccountTransaction } from "../../types";
import { GlanceSection } from "./PerformanceCard";

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
		const investmentFlows = summarizeInvestmentFlows(transactions);

		return {
			investmentFlows,
			interestEarned,
			totalDeposits,
			monthlyInterestEstimate,
			annualGrowthRate,
			isInvestment,
		};
	}, [transactions, account]);

	return (
		<GlanceSection
			rows={
				stats.isInvestment
					? [
							// Transfers count too: they move money in and out like deposits and withdrawals.
							{ label: "Deposited", value: formatCurrency(stats.investmentFlows.deposited), tone: "success" },
							{ label: "Withdrawn", value: formatCurrency(stats.investmentFlows.withdrawn) },
						]
					: [
							{ label: "Deposited", value: formatCurrency(stats.totalDeposits), tone: "success" },
							{ label: "Interest earned", value: formatCurrency(stats.interestEarned), tone: "success" },
							{
								label: "Growth this month, yearly",
								value: `${(stats.annualGrowthRate * 100).toFixed(2)}%`,
								tone: stats.annualGrowthRate > 0 ? "success" : "muted",
							},
							{
								label: "Expected interest a month",
								value: formatCurrency(stats.monthlyInterestEstimate),
								tone: "muted",
							},
						]
			}
		/>
	);
}
