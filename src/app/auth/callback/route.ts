import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	// if "next" is in param, use it as the redirect URL
	const next = searchParams.get("next") ?? "/";

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
			const isLocalEnv = process.env.NODE_ENV === "development";

			// Determine redirect URL
			let finalNext = next;
			if (next === "/" || next === "/dashboard") {
				// Check for existing params to append correctly
				const separator = next.includes("?") ? "&" : "?";
				finalNext = `${next}${separator}welcome=true`;
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
