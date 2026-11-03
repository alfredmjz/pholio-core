import { cache } from "react";
import { Logger } from "@/lib/logger";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { Database } from "@/lib/database.types";
import { sampleProfile } from "@/mock-data/profile";
import { isSampleDataMode } from "@/lib/demo-mode.server";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

/** The user's profile row, read once per server render. */
export const getProfileRow = cache(async (userId: string): Promise<UserProfile | null> => {
	const supabase = await createClient();
	const { data: profile, error } = await supabase.from("users").select("*").eq("id", userId).single();

	if (error || !profile) {
		Logger.error("[getProfileRow] Could not read profile", { error, userId });
		return null;
	}

	return profile;
});

/**
 * Fetches the authenticated user's profile from the database.
 *
 * @returns User profile object if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * const profile = await getUserProfile();
 * if (profile) {
 *   console.log(profile.full_name);
 * }
 * ```
 */
export async function getUserProfile(): Promise<UserProfile | null> {
	// Early return for sample data / demo mode
	if (await isSampleDataMode()) {
		return sampleProfile as UserProfile;
	}

	try {
		const user = await getAuthUser();

		if (!user) {
			return null;
		}

		return await getProfileRow(user.id);
	} catch (error) {
		Logger.error("Error fetching user profile", { error });
		return null;
	}
}
