import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { DEMO_COOKIE } from "@/lib/demo-mode";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";
import { redirect } from "next/navigation";
import { Logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const code = searchParams.get("code");
	const token_hash = searchParams.get("token_hash");
	const type = searchParams.get("type") as EmailOtpType | null;
	const next = searchParams.get("next") ?? "/dashboard";

	const supabase = await createClient();

	// @supabase/ssr uses the PKCE flow, so the magic-link email redirects here with
	// `?code=...`. We also accept the token_hash/type variant for robustness.
	let verified = false;
	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		verified = !error;
		if (error) Logger.warn("exchangeCodeForSession failed during confirm", { error: error.message });
	} else if (token_hash && type) {
		const { error } = await supabase.auth.verifyOtp({ type, token_hash });
		verified = !error;
		if (error) Logger.warn("verifyOtp failed during confirm", { type, error: error.message });
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
			}
		} catch (welcomeError) {
			Logger.warn("Welcome check failed during confirm", { error: welcomeError });
		}

		redirect(finalNext);
	}

	// redirect the user to an error page with some instructions
	redirect("/error");
}
