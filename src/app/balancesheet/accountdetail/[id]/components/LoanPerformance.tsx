"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import type { AccountWithType, AccountTransaction } from "../../../types";
import { differenceInMonths, parseISO } from "date-fns";

interface LoanPerformanceProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

export function LoanPerformance({ account, transactions, formatCurrency }: LoanPerformanceProps) {
	const stats = useMemo(() => {
		// Interest Paid
		const interestPaid = transactions
			.filter((t) => t.transaction_type === "interest")
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		// Principal Paid
		// Estimate: Original Amount - Current Balance
		// Borrowing 'target_balance' to store original loan amount in our schema
		const originalAmount = account.target_balance ?? 0;
		const currentBalance = account.current_balance;
		const principalPaid = Math.max(0, originalAmount - currentBalance);

		// Payment Due Date
		const now = new Date();
		const dueDay = account.payment_due_date || 15;
		const paymentDueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
		const dueDateStr = paymentDueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });

		// Remaining Term
		let remainingTermMsg = "N/A";
		if (account.loan_term_months && account.loan_start_date) {
			const startDate = parseISO(account.loan_start_date);
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
		<Card className="p-4">
			<h3 className="text-sm font-semibold text-primary mb-3">Performance</h3>
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Interest Paid</span>
					<span className="text-sm font-medium">{formatCurrency(stats.interestPaid)}</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Principal Paid</span>
					<span className="text-sm font-medium">{formatCurrency(stats.principalPaid)}</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Payment Due Date</span>
					<span className="text-sm font-medium text-muted-foreground">{stats.paymentDueDate}</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Remaining Term</span>
					<span className="text-sm font-medium">{stats.remainingTermMsg}</span>
				</div>
			</div>
		</Card>
	);
}
