"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";
import type { AccountWithType, AccountTransaction } from "../../../types";

interface CreditCardPerformanceProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

export function CreditCardPerformance({ account, transactions, formatCurrency }: CreditCardPerformanceProps) {
	const stats = useMemo(() => {
		// Interest charged is usually negative or positive depending on how it's logged.
		// If it's a liability, adding to the balance (debt) might be positive or negative depending on convention.
		// Usually schema stores absolute amounts or consistent signs.
		// Given 'interest' type, I will assume sum magnitude is what matters, or just display the sum.
		// If the user said "Interest Charged", they expect a value representing cost.
		const interestCharged = transactions
			.filter((t) => t.transaction_type === "interest")
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		// Use actual due date from account or fallback to 21st if not yet set
		const now = new Date();
		const dueDay = account.payment_due_date || 21;
		const paymentDueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);

		// Calculate Statement Amount based on user formula:
		// "payment due date as the first day until the following month"
		// Start: Payment Due Date
		// End: Start of next month
		const statementStart = paymentDueDate;
		const statementEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

		const statementAmount = transactions
			.filter((t) => {
				const d = parseLocalDate(t.transaction_date);
				return d >= statementStart && d < statementEnd;
			})
			.reduce((sum, t) => sum + t.amount, 0);

		// For display
		const dueDateStr = paymentDueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });

		return {
			interestCharged,
			paymentDueDate: dueDateStr,
			statementAmount,
		};
	}, [transactions]);

	return (
		<Card className="p-4">
			<h3 className="text-sm font-semibold text-primary mb-3">Performance</h3>
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Interest Charged</span>
					<span className="text-sm font-medium text-red-600 dark:text-red-400">
						{formatCurrency(stats.interestCharged)}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Payment Due Date</span>
					<span className="text-sm font-medium text-muted-foreground">{stats.paymentDueDate}</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-sm text-primary">Statement Amount</span>
					<span className="text-sm font-medium text-muted-foreground">{formatCurrency(stats.statementAmount)}</span>
				</div>
			</div>
		</Card>
	);
}
