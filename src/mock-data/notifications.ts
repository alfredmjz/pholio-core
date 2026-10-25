import type { AccountNotification } from "@/lib/notifications";
import { findDueReminders } from "@/lib/reminders";
import { getDemoNow, toDateOnly } from "./demo-date";
import { getMockRecurringExpenses } from "./recurring";

/** The sample bills and subscriptions due in the next two weeks, as unread reminders. */
export function getSampleNotifications(now: Date = getDemoNow()): AccountNotification[] {
	const recurring = getMockRecurringExpenses(now)
		.filter((item) => item.is_active !== false)
		.map((item) => ({
			id: item.id,
			name: item.name,
			amount: Number(item.amount),
			nextDueDate: item.next_due_date.slice(0, 10),
			category: item.category === "bill" ? ("bill" as const) : ("subscription" as const),
		}));

	return findDueReminders({ today: toDateOnly(now), leadDays: 14, cards: [], recurring }).map((reminder) => ({
		id: `sample-${reminder.kind}-${reminder.refId}`,
		kind: reminder.kind,
		refId: reminder.refId,
		dueDate: reminder.dueDate,
		name: reminder.name,
		detail: reminder.detail,
		amount: reminder.amount,
		createdAt: now.toISOString(),
		readAt: null,
	}));
}
