import { monthlyEquivalent } from "./recurring-schedule";

export type RecurringKind = "bill" | "subscription" | "transfer";

interface RecurringItem {
	id: string;
	name: string;
	amount: number | string;
	category: string;
	account_id?: string | null;
	to_account_id?: string | null;
}

export function isRecurringTransfer(item: { category: string }): boolean {
	return item.category === "transfer";
}

/** A transfer posts only between two different accounts that are both still active. */
export function canPostTransfer(
	item: { account_id?: string | null; to_account_id?: string | null },
	activeAccountIds: ReadonlySet<string>
): boolean {
	const from = item.account_id;
	const to = item.to_account_id;
	return Boolean(from && to && from !== to && activeAccountIds.has(from) && activeAccountIds.has(to));
}

export interface RecurringOccurrenceRow {
	user_id: string;
	name: string;
	amount: number;
	transaction_date: string;
	covers_due_date: string;
	category_id: string | null;
	source: "recurring" | "transfer";
	recurring_expense_id: string;
	notes: string;
}

/**
 * The budget row one occurrence inserts. A bill or subscription is a negative 'recurring' row in its
 * budget category. A transfer is a positive 'transfer' row with no category, the shape of a manual
 * transfer; migration 016 posts its two account legs.
 */
export function recurringOccurrenceRow(
	expense: RecurringItem,
	occurrence: {
		userId: string;
		transactionDate: string;
		coversDueDate: string;
		categoryId: string | null;
		notes: string;
	}
): RecurringOccurrenceRow {
	const amount = Math.abs(Number(expense.amount));
	const transfer = isRecurringTransfer(expense);
	return {
		user_id: occurrence.userId,
		name: expense.name,
		amount: transfer ? amount : -amount,
		transaction_date: occurrence.transactionDate,
		covers_due_date: occurrence.coversDueDate,
		category_id: transfer ? null : occurrence.categoryId,
		source: transfer ? "transfer" : "recurring",
		recurring_expense_id: expense.id,
		notes: occurrence.notes,
	};
}

/**
 * Average monthly amount of the active items by kind. `spending` is bills plus subscriptions;
 * transfers move money between the user's own accounts, so they are not spending.
 */
export function monthlyTotalsByKind(
	items: Array<{ amount: number | string; billing_period: string; category: string; is_active?: boolean | null }>
): Record<RecurringKind, number> & { spending: number } {
	const totals = { bill: 0, subscription: 0, transfer: 0 };
	for (const item of items) {
		if (item.is_active === false) continue;
		const kind: RecurringKind =
			item.category === "transfer" ? "transfer" : item.category === "bill" ? "bill" : "subscription";
		totals[kind] += monthlyEquivalent(Number(item.amount), item.billing_period);
	}
	return { ...totals, spending: totals.bill + totals.subscription };
}
