import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/getUserProfile";

/**
 * Result of authentication check
 */
export interface AuthResult {
	user: User;
	profile: UserProfile;
}

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
	console.log("[requireAuth] Start");
	const supabase = await createClient();

	// Check if user is authenticated
	console.log("[requireAuth] Calling auth.getUser()");
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();
	console.log("[requireAuth] auth.getUser() result:", { hasUser: !!user, error: authError?.message });

	if (authError || !user) {
		console.log("[requireAuth] No user, redirecting to /login");
		redirect("/login");
	}

	// Fetch user profile
	console.log("[requireAuth] Fetching user profile for:", user.id);
	const { data: profile, error: profileError } = await supabase.from("users").select("*").eq("id", user.id).single();
	console.log("[requireAuth] Profile fetch result:", { hasProfile: !!profile, error: profileError?.message });

	if (profileError || !profile) {
		console.error("[requireAuth] Profile not found for authenticated user:", profileError);
		// User is authenticated but has no profile - should never happen due to DB trigger
		// Sign them out and redirect to login
		await supabase.auth.signOut();
		console.log("[requireAuth] Signed out user, redirecting to /login");
		redirect("/login");
	}

	console.log("[requireAuth] Success, returning user and profile");
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
		console.error("Error getting auth:", error);
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
