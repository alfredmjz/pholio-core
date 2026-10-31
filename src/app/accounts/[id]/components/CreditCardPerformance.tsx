"use client";

import { useMemo } from "react";
import type { CardStatement } from "@/lib/credit-card-statement";
import { formatShortDate, parseLocalDate } from "@/lib/date-utils";
import type { AccountWithType, AccountTransaction } from "../../types";
import { getFieldVisibility } from "../../field-visibility";
import { GlanceSection, type GlanceRow } from "./PerformanceCard";

interface CreditCardPerformanceProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	/** The latest closed statement; null for a card without a due day, or a line of credit. */
	statement?: CardStatement | null;
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
	formatCurrency: (amount: number) => string;
}

export function CreditCardPerformance({
	account,
	transactions,
	statement,
	today,
	formatCurrency,
}: CreditCardPerformanceProps) {
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

	const interestRow: GlanceRow = {
		label: "Interest charged",
		value: formatCurrency(stats.interestCharged),
		tone: stats.interestCharged > 0 ? "error" : "muted",
	};

	if (getFieldVisibility(account.account_type, account.field_visibility).showStatementDay) {
		if (!statement) {
			return (
				<GlanceSection rows={[{ label: "Statement balance", value: "Add a due date", tone: "muted" }, interestRow]} />
			);
		}

		const due = formatShortDate(statement.dueDate);
		const overdue = !statement.paidInFull && statement.dueDate < today;
		return (
			<GlanceSection
				rows={[
					{ label: "Statement closed", value: formatShortDate(statement.closeDate) },
					{ label: "Statement balance", value: formatCurrency(statement.statementBalance) },
					{ label: "Paid since statement", value: formatCurrency(statement.paidSinceClose) },
					statement.paidInFull
						? { label: `Due ${due}`, value: "Paid in full", tone: "success" }
						: {
								label: overdue ? `Unpaid since ${due}` : `Left to pay by ${due}`,
								value: formatCurrency(statement.remainingDue),
								tone: overdue ? "error" : undefined,
							},
					interestRow,
				]}
			/>
		);
	}

	return (
		<GlanceSection
			rows={[
				interestRow,
				{ label: "Payment due", value: stats.paymentDueDate },
				{ label: "This statement", value: formatCurrency(stats.statementAmount) },
			]}
		/>
	);
}
