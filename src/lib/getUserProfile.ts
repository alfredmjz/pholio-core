import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/database.types";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

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
	try {
		const supabase = await createClient();

		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();

		if (userError || !user) {
			return null;
		}

		const { data: profile, error: profileError } = await supabase.from("users").select("*").eq("id", user.id).single();

		if (profileError || !profile) {
			return null;
		}

		return profile;
	} catch (error) {
		console.error("Error fetching user profile:", error);
		return null;
	}
}
