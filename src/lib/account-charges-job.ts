import { getTodayDateString } from "@/lib/date-utils";
import { Logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/server";
import { REMINDER_FALLBACK_TIMEZONE } from "@/lib/reminder-jobs";

/**
 * Posts every monthly and yearly account charge that is due (Called by Cron Job). The rules,
 * including the minimum-balance waiver, live in post_due_account_charges() (migration 012).
 *
 * Uses the admin client, which bypasses RLS, so it must stay out of "use server" files.
 */
export async function postDueAccountCharges(): Promise<{ success: boolean; posted: number; error?: string }> {
	try {
		const { data, error } = await createAdminClient().rpc("post_due_account_charges", {
			p_today: getTodayDateString(REMINDER_FALLBACK_TIMEZONE),
		});
		if (error) {
			Logger.error("Error posting account charges", { error });
			return { success: false, posted: 0, error: "Failed to post account charges" };
		}
		return { success: true, posted: Number(data ?? 0) };
	} catch (error) {
		Logger.error("Failed account charge posting", { error });
		return { success: false, posted: 0, error: "Internal processing error" };
	}
}
