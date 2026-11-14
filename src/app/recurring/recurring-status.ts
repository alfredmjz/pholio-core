import { calculateNextDueDate, formatDateString, parseLocalDate } from "@/lib/date-utils";
import { coveredDueDate, paymentsForMonth } from "./recurring-schedule";
import type { RecurringExpense, RecurringExpenseStatus } from "./recurring-types";

export interface MonthPayment {
	id?: string;
	name: string;
	amount: number;
	transaction_date: string;
	recurring_expense_id: string | null;
	covers_due_date?: string | null;
}

export interface RecordedOccurrence {
	recurring_expense_id: string;
	occurrence_date: string;
	amount: number | string;
}

/** Adds this month's paid/unpaid status, counts and scheduled changes to each recurring item. */
export function enrichRecurringExpenses(
	expenses: RecurringExpense[],
	allTransactions: MonthPayment[],
	recordedOccurrences: RecordedOccurrence[],
	now: Date = new Date()
): RecurringExpense[] {
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
	const monthStart = formatDateString(new Date(now.getFullYear(), now.getMonth(), 1));
	const monthEnd = formatDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));

	if (!expenses.length) return [];
	const transactions = paymentsForMonth(allTransactions, monthStart, monthEnd);

	const enrichedExpenses = expenses.map((expense) => {
		let status: RecurringExpenseStatus = "upcoming";
		let paidAmount = 0;

		const todayStr = now.toLocaleDateString("en-CA");
		const dueStr = expense.next_due_date.split("T")[0];
		const isPastDue = todayStr > dueStr;
		const isDueToday = todayStr === dueStr;

		if (transactions.length > 0) {
			const manualMatches = transactions.filter((t) => t.recurring_expense_id === expense.id);

			if (manualMatches.length > 0) {
				paidAmount = manualMatches.reduce((sum, t) => sum + Math.abs(t.amount), 0);
			} else {
				const autoMatches = transactions.filter(
					(t) =>
						// Ensure not linked to another expense
						!t.recurring_expense_id &&
						(t.name.toLowerCase().includes(expense.name.toLowerCase()) ||
							expense.name.toLowerCase().includes(t.name.toLowerCase()))
				);
				paidAmount = autoMatches.reduce((sum, t) => sum + Math.abs(t.amount), 0);
			}
		}

		// Calculate Counts

		const paidTransactions = transactions.filter(
			(t) =>
				t.recurring_expense_id === expense.id ||
				(!t.recurring_expense_id &&
					(t.name.toLowerCase().includes(expense.name.toLowerCase()) ||
						expense.name.toLowerCase().includes(t.name.toLowerCase())))
		);
		const paidCount = paidTransactions.length;

		const toDateStr = (d: Date | string) => {
			if (typeof d === "string") return d.split("T")[0];
			return d.toISOString().split("T")[0];
		};

		// Set of dates already paid for this expense
		const paidDates = new Set(paidTransactions.map((t) => coveredDueDate(t)));

		// Recorded occurrences for this expense in the current month. An occurrence
		// whose transaction was deleted still counts as an occurrence (0 of 1 paid).
		const monthMarkers = recordedOccurrences.filter((m) => m.recurring_expense_id === expense.id);
		const markerDates = new Set(monthMarkers.map((m) => toDateStr(m.occurrence_date)));
		const deletedAutoPaymentCount = monthMarkers.filter((m) => !paidDates.has(toDateStr(m.occurrence_date))).length;

		let futureCount = 0;
		let tempDate = new Date(expense.next_due_date);

		const endOfMonthDate = new Date(endOfMonth);

		// If next due date is already past end of month, futureCount is 0
		// Otherwise, count how many fall within this month
		while (tempDate <= endOfMonthDate) {
			const tempDateStr = toDateStr(tempDate);

			// Only count if this specific date hasn't been paid or recorded yet
			if (!paidDates.has(tempDateStr) && !markerDates.has(tempDateStr)) {
				futureCount++;
			}

			tempDate = calculateNextDueDate(tempDate, expense.billing_period);
		}

		const totalOccurrences = paidCount + futureCount + deletedAutoPaymentCount;

		// Compare against the amount captured when the occurrence was recorded so an
		// edit to next month's amount doesn't turn a paid month into "partial".
		const recordedExpectedAmount = monthMarkers.reduce((sum, m) => sum + Math.abs(Number(m.amount)), 0);
		const expectedAmount = recordedExpectedAmount > 0 ? recordedExpectedAmount : Number(expense.amount);

		if (paidAmount > 0 && paidAmount >= expectedAmount && futureCount === 0) {
			status = "paid";
		} else if (paidAmount > 0) {
			status = "partial";
		} else if (isPastDue) {
			status = "overdue";
		} else if (isDueToday) {
			status = "due_today";
		} else {
			status = "upcoming";
		}

		let displayDueDate = expense.next_due_date;
		const nextDueStrictStr = toDateStr(expense.next_due_date);
		if (paidDates.has(nextDueStrictStr)) {
			displayDueDate = calculateNextDueDate(new Date(expense.next_due_date), expense.billing_period).toISOString();
		}

		// Detect changes scheduled for the next cycle so the card can distinguish the
		// upcoming amount/date from what was actually paid this cycle.
		let nextAmountChange: RecurringExpense["next_amount_change"];
		let nextDueChange: RecurringExpense["next_due_change"];

		if (monthMarkers.length > 0) {
			const latestMarker = [...monthMarkers].sort((a, b) =>
				toDateStr(b.occurrence_date).localeCompare(toDateStr(a.occurrence_date))
			)[0];
			const latestDateStr = toDateStr(latestMarker.occurrence_date);
			const recordedAmount = Math.abs(Number(latestMarker.amount));
			const currentAmount = Number(expense.amount);

			if (recordedAmount !== currentAmount) {
				nextAmountChange = { from: recordedAmount, to: currentAmount };
			}

			const naturalNextDue = formatDateString(
				calculateNextDueDate(parseLocalDate(latestDateStr), expense.billing_period)
			);
			const actualNextDue = displayDueDate ? displayDueDate.split("T")[0] : toDateStr(expense.next_due_date);
			if (naturalNextDue !== actualNextDue) {
				nextDueChange = { from: naturalNextDue, to: actualNextDue };
			}
		}

		return {
			...expense,
			next_due_date: displayDueDate,
			status,
			paid_amount: paidAmount,
			paid_count: paidCount,
			occurrences_count: totalOccurrences,
			deleted_auto_payments: deletedAutoPaymentCount,
			next_amount_change: nextAmountChange,
			next_due_change: nextDueChange,
		};
	});

	return enrichedExpenses;
}
