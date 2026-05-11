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
		const interestCharged = transactions
			.filter((t) => t.transaction_type === "interest")
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);

		const now = new Date();
		const dueDay = account.payment_due_date || 21;
		const paymentDueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);

		/** Statement window: from payment due date to the start of next month. */
		const statementStart = paymentDueDate;
		const statementEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

		const statementAmount = transactions
			.filter((t) => {
				const d = parseLocalDate(t.transaction_date);
				return d >= statementStart && d < statementEnd;
			})
			.reduce((sum, t) => sum + t.amount, 0);

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
