import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { DEMO_COOKIE } from "@/lib/demo-mode";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";
import { redirect } from "next/navigation";
import { Logger } from "@/lib/logger";
import { clearMagicLinkSends } from "@/lib/magic-link-limit.server";

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const code = searchParams.get("code");
	const token_hash = searchParams.get("token_hash");
	const type = searchParams.get("type") as EmailOtpType | null;
	const next = searchParams.get("next") ?? "/dashboard";

	const supabase = await createClient();

	// The email template links here with `?token_hash=...&type=email`, which works in any
	// browser. A PKCE `?code=...` only works in the browser that requested the link (it
	// needs that browser's code-verifier cookie), so it is kept for older emails only.
	let verified = false;
	if (token_hash && type) {
		const { error } = await supabase.auth.verifyOtp({ type, token_hash });
		verified = !error;
		if (error) Logger.warn("verifyOtp failed during confirm", { type, error: error.message });
	} else if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		verified = !error;
		if (error) Logger.warn("exchangeCodeForSession failed during confirm", { error: error.message });
	}

	if (verified) {
		// Signing in always ends the demo session.
		const cookieStore = await cookies();
		cookieStore.delete(DEMO_SESSION_COOKIE);
		cookieStore.delete(DEMO_COOKIE);

		// Show the welcome celebration on a user's first login, then mark it seen.
		let finalNext = next;
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (user) {
				const { data: profile } = await supabase.from("users").select("has_seen_welcome").eq("id", user.id).single();

				if (profile && profile.has_seen_welcome !== true) {
					await supabase.from("users").update({ has_seen_welcome: true }).eq("id", user.id);
					const separator = next.includes("?") ? "&" : "?";
					finalNext = `${next}${separator}welcome=true`;
				}

				// Links already sent stop counting, so signing out and back in starts a fresh limit.
				if (user.email) {
					await clearMagicLinkSends(user.email).catch((clearError) =>
						Logger.warn("Clearing magic link sends failed during confirm", { error: clearError })
					);
				}
			}
		} catch (welcomeError) {
			Logger.warn("Welcome check failed during confirm", { error: welcomeError });
		}

		redirect(finalNext);
	}

	// A link opened twice fails the second time, but the first open already signed
	// this browser in, so carry on into the app.
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (user) redirect(next);

	redirect("/error?reason=link");
}
