import { redirect } from "next/navigation";
import { Logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/getUserProfile";
import { sampleProfile } from "@/mock-data/profile";

/**
 * Result of authentication check
 */
export interface AuthResult {
	user: User;
	profile: UserProfile;
}

/**
 * Mock user for sample data mode
 */
const mockUser: User = {
	id: sampleProfile.id,
	email: sampleProfile.email,
	app_metadata: {},
	user_metadata: {},
	aud: "authenticated",
	created_at: sampleProfile.created_at,
};

/**
 * Requires authentication and valid user profile.
 * Automatically redirects to login if user is not authenticated or profile is missing.
 *
 * @returns Object containing authenticated user and their profile
 * @throws Redirects to /login if not authenticated
 *
 * @example
 * ```typescript
 * export default async function ProtectedPage() {
 *   const { user, profile } = await requireAuth();
 *   return <div>Hello {profile.full_name}</div>;
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
	// Early return for sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return {
			user: mockUser,
			profile: sampleProfile as UserProfile,
		};
	}

	const supabase = await createClient();

	// Check if user is authenticated

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		redirect("/login");
	}

	// Fetch user profile

	const { data: profile, error: profileError } = await supabase.from("users").select("*").eq("id", user.id).single();

	if (profileError || !profile) {
		Logger.error("[requireAuth] Profile not found for authenticated user", { profileError });
		// User is authenticated but has no profile - should never happen due to DB trigger
		// Sign them out and redirect to login
		await supabase.auth.signOut();

		redirect("/login");
	}

	return { user, profile: profile as UserProfile };
}

/**
 * Gets the current authenticated user and profile without redirecting.
 * Returns null if not authenticated or profile is missing.
 *
 * @returns Object with user and profile, or null if not authenticated
 *
 * @example
 * ```typescript
 * export default async function OptionalAuthPage() {
 *   const auth = await getAuth();
 *   if (auth) {
 *     return <div>Logged in as {auth.profile.full_name}</div>;
 *   }
 *   return <div>Not logged in</div>;
 * }
 * ```
 */
export async function getAuth(): Promise<AuthResult | null> {
	// Early return for sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return {
			user: mockUser,
			profile: sampleProfile as UserProfile,
		};
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return null;
		}

		const { data: profile, error: profileError } = await supabase.from("users").select("*").eq("id", user.id).single();

		if (profileError || !profile) {
			return null;
		}

		return { user, profile: profile as UserProfile };
	} catch (error) {
		Logger.error("Error getting auth", { error });
		return null;
	}
}

/**
 * Checks if the current user is a guest account.
 *
 * @returns True if user is authenticated and is a guest, false otherwise
 */
export async function isGuestUser(): Promise<boolean> {
	const auth = await getAuth();
	return auth?.profile.is_guest ?? false;
}
