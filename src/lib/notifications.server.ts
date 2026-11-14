import { unstable_rethrow } from "next/navigation";
import { hasUnreadChangelog } from "@/lib/changelog";
import { getReadContext } from "@/lib/data-context.server";
import type { UserProfile } from "@/lib/getUserProfile";
import { Logger } from "@/lib/logger";
import { notificationStore } from "@/lib/notification-store";
import { NO_UNREAD, type UnreadNotifications } from "@/lib/notifications";

/** Whether the bell needs its dot, for the root layout. */
export async function getUnreadNotifications(profile: UserProfile | null): Promise<UnreadNotifications> {
	if (!profile) return NO_UNREAD;

	const changelog = hasUnreadChangelog(profile.changelog_seen_at ?? null, profile.created_at);

	try {
		const ctx = await getReadContext();
		if (!ctx) return { account: false, changelog };
		return { account: await notificationStore(ctx).hasUnread(), changelog };
	} catch (error) {
		unstable_rethrow(error);
		Logger.error("Error counting unread notifications", { error });
		return { account: false, changelog };
	}
}
