import { hasUnreadChangelog } from "@/lib/changelog";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import type { UserProfile } from "@/lib/getUserProfile";
import { Logger } from "@/lib/logger";
import { NO_UNREAD, type UnreadNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { getSampleNotifications } from "@/mock-data/notifications";

/** Whether the bell needs its dot, for the root layout. */
export async function getUnreadNotifications(profile: UserProfile | null): Promise<UnreadNotifications> {
	if (!profile) return NO_UNREAD;

	const changelog = hasUnreadChangelog(profile.changelog_seen_at ?? null, profile.created_at);

	if (await isSampleDataMode()) {
		return { account: getSampleNotifications().length > 0, changelog };
	}

	try {
		const supabase = await createClient();
		const { count, error } = await supabase
			.from("notifications")
			.select("id", { count: "exact", head: true })
			.eq("user_id", profile.id)
			.is("read_at", null);
		if (error) throw error;
		return { account: (count ?? 0) > 0, changelog };
	} catch (error) {
		Logger.error("Error counting unread notifications", { error });
		return { account: false, changelog };
	}
}
