"use server";

import { createClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { toAccountNotification, type AccountNotification } from "@/lib/notifications";
import { getSampleNotifications } from "@/mock-data/notifications";

const NOTIFICATION_COLUMNS = "id, kind, ref_id, due_date, name, detail, amount, created_at, read_at";
const LIST_LIMIT = 30;

export async function getAccountNotifications(): Promise<AccountNotification[]> {
	if (await isSampleDataMode()) return getSampleNotifications();

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return [];

		const { data, error } = await supabase
			.from("notifications")
			.select(NOTIFICATION_COLUMNS)
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.order("due_date", { ascending: true })
			.limit(LIST_LIMIT);
		if (error) {
			Logger.error("Error loading notifications", { error });
			return [];
		}
		return (data ?? []).map(toAccountNotification);
	} catch (error) {
		Logger.error("Unexpected error in getAccountNotifications", { error });
		return [];
	}
}

export async function markNotificationsRead(ids: string[]): Promise<{ success: boolean }> {
	if (ids.length === 0 || (await isSampleDataMode())) return { success: true };

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { success: false };

		const { error } = await supabase
			.from("notifications")
			.update({ read_at: new Date().toISOString() })
			.eq("user_id", user.id)
			.in("id", ids)
			.is("read_at", null);
		if (error) {
			Logger.error("Error marking notifications read", { error });
			return { success: false };
		}
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in markNotificationsRead", { error });
		return { success: false };
	}
}

export async function markChangelogSeen(): Promise<{ success: boolean }> {
	if (await isSampleDataMode()) return { success: true };

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { success: false };

		const { error } = await supabase
			.from("users")
			.update({ changelog_seen_at: new Date().toISOString() })
			.eq("id", user.id);
		if (error) {
			Logger.error("Error marking the changelog seen", { error });
			return { success: false };
		}
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in markChangelogSeen", { error });
		return { success: false };
	}
}
