import type { ReminderKind } from "@/lib/reminders";

export interface AccountNotification {
	id: string;
	kind: ReminderKind;
	refId: string;
	dueDate: string;
	name: string;
	detail: string;
	amount: number;
	createdAt: string;
	readAt: string | null;
}

export interface UnreadNotifications {
	account: boolean;
	changelog: boolean;
}

export const NO_UNREAD: UnreadNotifications = { account: false, changelog: false };

/** Where selecting a reminder takes you. */
export function notificationHref(notification: Pick<AccountNotification, "kind" | "refId">): string {
	return notification.kind === "recurring_due" ? "/recurring" : `/accounts/${notification.refId}`;
}

export function toAccountNotification(row: Record<string, unknown>): AccountNotification {
	return {
		id: String(row.id),
		kind: row.kind as ReminderKind,
		refId: String(row.ref_id),
		dueDate: String(row.due_date),
		name: String(row.name),
		detail: String(row.detail),
		amount: Number(row.amount),
		createdAt: String(row.created_at),
		readAt: typeof row.read_at === "string" ? row.read_at : null,
	};
}
