"use client";

import { useMemo } from "react";
import type { AccountWithType, AccountTransaction } from "../../types";
import { GlanceSection } from "./PerformanceCard";
import { differenceInMonths, parseLocalDate } from "@/lib/date-utils";

interface LoanPerformanceProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

export function LoanPerformance({ account, transactions, formatCurrency }: LoanPerformanceProps) {
	const stats = useMemo(() => {
		const interestPaid = transactions
			.filter((t) => t.transaction_type === "interest")
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		/** Uses dedicated original_amount for debt, fallbacks to target_balance for older data. */
		const originalAmount = account.original_amount ?? account.target_balance ?? 0;
		const currentBalance = account.current_balance;
		const principalPaid = Math.max(0, originalAmount - currentBalance);

		const now = new Date();
		const dueDay = account.payment_due_date || 15;
		const paymentDueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
		const dueDateStr = paymentDueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });

		let remainingTermMsg = "N/A";
		if (account.loan_term_months && account.loan_start_date) {
			const startDate = parseLocalDate(account.loan_start_date);
			const monthsPassed = differenceInMonths(new Date(), startDate);
			const remaining = Math.max(0, account.loan_term_months - monthsPassed);
			const years = Math.floor(remaining / 12);
			const months = remaining % 12;

			if (years > 0) {
				remainingTermMsg = `${years}y ${months}m`;
			} else {
				remainingTermMsg = `${months}m`;
			}
		}

		return {
			interestPaid,
			principalPaid,
			remainingTermMsg,
			paymentDueDate: dueDateStr,
		};
	}, [transactions, account]);

	return (
		<GlanceSection
			rows={[
				{ label: "Principal paid", value: formatCurrency(stats.principalPaid), tone: "success" },
				{ label: "Interest paid", value: formatCurrency(stats.interestPaid) },
				{ label: "Payment due", value: stats.paymentDueDate },
				{
					label: "Time left",
					value: stats.remainingTermMsg === "N/A" ? "Not set" : stats.remainingTermMsg,
					tone: stats.remainingTermMsg === "N/A" ? "muted" : undefined,
				},
			]}
		/>
	);
}
