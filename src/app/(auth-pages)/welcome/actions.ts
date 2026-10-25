"use server";

import { revalidatePath } from "next/cache";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { Logger } from "@/lib/logger";
import { cleanFullName } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

function isTimeZone(value: unknown): value is string {
	if (typeof value !== "string" || !value) return false;
	try {
		new Intl.DateTimeFormat("en-CA", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

/** Saves the new user's name, and their device's time zone unless they already have one. */
export async function completeOnboarding(
	fullName: string,
	deviceTimeZone: string | null
): Promise<{ success: boolean; error?: string }> {
	const cleaned = cleanFullName(fullName);
	if (cleaned.error !== undefined) return { success: false, error: cleaned.error };

	if (await isSampleDataMode()) return { success: true };

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { success: false, error: "Your sign-in expired. Sign in again." };

		const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();
		const updates: Record<string, unknown> = {
			full_name: cleaned.name,
			has_seen_welcome: true,
			updated_at: new Date().toISOString(),
		};
		if (!profile?.timezone && isTimeZone(deviceTimeZone)) updates.timezone = deviceTimeZone;

		const { error } = await supabase.from("users").update(updates).eq("id", user.id);
		if (error) {
			Logger.error("Could not finish onboarding", { error });
			return { success: false, error: "Couldn't save that. Try again." };
		}

		revalidatePath("/", "layout");
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in completeOnboarding", { error });
		return { success: false, error: "Couldn't save that. Try again." };
	}
}
