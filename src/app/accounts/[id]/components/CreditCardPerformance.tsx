"use client";

import { useMemo } from "react";
import { parseLocalDate } from "@/lib/date-utils";
import type { AccountWithType, AccountTransaction } from "../../types";
import { GlanceSection } from "./PerformanceCard";

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
		<GlanceSection
			rows={[
				{
					label: "Interest charged",
					value: formatCurrency(stats.interestCharged),
					tone: stats.interestCharged > 0 ? "error" : "muted",
				},
				{ label: "Payment due", value: stats.paymentDueDate },
				{ label: "This statement", value: formatCurrency(stats.statementAmount) },
			]}
		/>
	);
}
