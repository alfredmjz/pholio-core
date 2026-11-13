"use server";

import { z } from "zod";
import { idSchema } from "@/lib/action-schemas";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { Logger } from "@/lib/logger";
import { notificationStore } from "@/lib/notification-store";
import type { AccountNotification } from "@/lib/notifications";

export async function getAccountNotifications(): Promise<AccountNotification[]> {
	try {
		const ctx = await getReadContext();
		return ctx ? await notificationStore(ctx).list() : [];
	} catch (error) {
		Logger.error("Unexpected error in getAccountNotifications", { error });
		return [];
	}
}

export const markNotificationsRead = defineAction("markNotificationsRead", [z.array(idSchema)], async (ctx, ids) => {
	if (ids.length === 0) return;
	await notificationStore(ctx).markRead(ids);
});

export const markChangelogSeen = defineAction("markChangelogSeen", [], async (ctx) => {
	await notificationStore(ctx).markChangelogSeen();
});
