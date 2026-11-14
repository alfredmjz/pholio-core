import { Logger } from "@/lib/logger";
import type { DataContext, DemoContext, SupabaseContext } from "@/lib/data-context.server";
import { toAccountNotification, type AccountNotification } from "@/lib/notifications";
import { getSampleNotifications } from "@/mock-data/notifications";

const NOTIFICATION_COLUMNS = "id, kind, ref_id, due_date, name, detail, amount, created_at, read_at";
const LIST_LIMIT = 30;

export interface NotificationStore {
	list(): Promise<AccountNotification[]>;
	hasUnread(): Promise<boolean>;
	markRead(ids: string[]): Promise<void>;
	markChangelogSeen(): Promise<void>;
}

export function notificationStore(ctx: DataContext): NotificationStore {
	return ctx.kind === "demo" ? demoNotificationStore(ctx) : supabaseNotificationStore(ctx);
}

function supabaseNotificationStore({ db, userId }: SupabaseContext): NotificationStore {
	return {
		async list() {
			const { data, error } = await db
				.from("notifications")
				.select(NOTIFICATION_COLUMNS)
				.eq("user_id", userId)
				.order("created_at", { ascending: false })
				.order("due_date", { ascending: true })
				.limit(LIST_LIMIT);
			if (error) {
				Logger.error("Error loading notifications", { error });
				return [];
			}
			return (data ?? []).map(toAccountNotification);
		},

		async hasUnread() {
			const { count, error } = await db
				.from("notifications")
				.select("id", { count: "exact", head: true })
				.eq("user_id", userId)
				.is("read_at", null);
			if (error) throw error;
			return (count ?? 0) > 0;
		},

		async markRead(ids) {
			const { error } = await db
				.from("notifications")
				.update({ read_at: new Date().toISOString() })
				.eq("user_id", userId)
				.in("id", ids)
				.is("read_at", null);
			if (error) throw error;
		},

		async markChangelogSeen() {
			const { error } = await db.from("users").update({ changelog_seen_at: new Date().toISOString() }).eq("id", userId);
			if (error) throw error;
		},
	};
}

/** The sample reminders are always unread and marking them read isn't kept. */
function demoNotificationStore(_ctx: DemoContext): NotificationStore {
	return {
		async list() {
			return getSampleNotifications();
		},
		async hasUnread() {
			return getSampleNotifications().length > 0;
		},
		async markRead() {},
		async markChangelogSeen() {},
	};
}
