import { Logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * Gets the Google OAuth access token from the current session.
 *
 * Note: This requires the user to be signed in with Google and scopes to be configured
 * in the initial sign-in or via a re-authentication/linking flow.
 *
 * In Supabase, the provider_token is available in the session object.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
	const supabase = await createClient();

	const {
		data: { session },
		error,
	} = await supabase.auth.getSession();

	if (error || !session) {
		Logger.error("Error getting session for Google Auth", { error });
		return null;
	}

	// Supabase stores the provider token in the session if enabled
	// Check session.provider_token or session.user.app_metadata.provider_token or similar based on config
	// Standard OAuth flow usually exposes it in the session object directly after sign-in if configured
	const providerToken = session.provider_token;

	if (!providerToken) {
		Logger.warn("No provider token found in session. User might need to re-authenticate with Google.");
		return null;
	}

	return providerToken;
}
