import { createClient } from "@/lib/supabase/server";
import { DEMO_COOKIE } from "@/lib/demo-mode";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { needsOnboarding, onboardingPath, safeNextPath } from "@/lib/onboarding";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	const next = safeNextPath(searchParams.get("next"));

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			// Signing in always ends the demo session.
			const cookieStore = await cookies();
			cookieStore.delete(DEMO_SESSION_COOKIE);
			cookieStore.delete(DEMO_COOKIE);

			const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
			const isLocalEnv = process.env.NODE_ENV === "development";

			// Someone without a name (a new account) sets it up before going on.
			let finalNext = next;
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (user) {
				const { data: profile } = await supabase.from("users").select("full_name").eq("id", user.id).single();
				if (needsOnboarding(profile)) finalNext = onboardingPath(next);
			}

			if (isLocalEnv) {
				// we can be sure that there is no load balancer in between
				return NextResponse.redirect(`${origin}${finalNext}`);
			} else if (forwardedHost) {
				// Use the protocol from the request or default to https if typical prod setup
				// check if forwardedHost contains localhost or 127.0.0.1 to avoid forcing https
				const isLocalForwarded = forwardedHost.includes("localhost") || forwardedHost.includes("127.0.0.1");
				const protocol = isLocalForwarded ? "http" : "https";
				return NextResponse.redirect(`${protocol}://${forwardedHost}${finalNext}`);
			} else {
				return NextResponse.redirect(`${origin}${finalNext}`);
			}
		}
	}

	// return the user to an error page with instructions
	return NextResponse.redirect(`${origin}/error`);
}
