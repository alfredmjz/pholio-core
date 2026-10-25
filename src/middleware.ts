import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { DEMO_COOKIE, DEMO_COOKIE_MAX_AGE, DEMO_HEADER } from "@/lib/demo-mode";
import { DEMO_SESSION_COOKIE, isValidDemoSession } from "@/lib/demo-session";
import { isPublicRoute } from "@/lib/routes";
import { withoutUnknownParams } from "@/lib/page-params";

/*
 * Server Components can't write cookies, this refresh expired Auth tokens and store them
 */
export async function middleware(request: NextRequest) {
	// Only full page loads: client navigations carry Next's own parameters.
	if (request.headers.get("sec-fetch-dest") === "document") {
		const kept = withoutUnknownParams(request.nextUrl.pathname, request.nextUrl.searchParams);
		if (kept) {
			const url = request.nextUrl.clone();
			url.search = kept.toString();
			return NextResponse.redirect(url);
		}
	}

	// Skip auth session update if using sample data to avoid fetch errors when offline/unconfigured
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return NextResponse.next({ request });
	}

	const pathname = request.nextUrl.pathname;

	// A demo session is only issued by the "Try the demo" server action.
	const demoSessionValid = await isValidDemoSession(request.cookies.get(DEMO_SESSION_COOKIE)?.value);

	// Public routes never require auth.
	if (isPublicRoute(pathname)) {
		return updateSession(request);
	}

	// API routes enforce their own auth.
	if (pathname.startsWith("/api/")) {
		return demoSessionValid ? NextResponse.next({ request }) : updateSession(request);
	}

	// A valid demo session grants access to the normal app routes, served with
	// sample data. Without it (and without a signed-in user) the route is guarded
	// by updateSession below.
	if (demoSessionValid) {
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set(DEMO_HEADER, "1");

		const response = NextResponse.next({ request: { headers: requestHeaders } });
		response.cookies.set(DEMO_COOKIE, "1", {
			path: "/",
			maxAge: DEMO_COOKIE_MAX_AGE,
			sameSite: "lax",
		});
		return response;
	}

	const result = await updateSession(request);

	// Drop a stale UI marker left behind without a valid signed session.
	if (request.cookies.get(DEMO_COOKIE)?.value === "1") {
		result.cookies.delete(DEMO_COOKIE);
		result.cookies.delete(DEMO_SESSION_COOKIE);
	}

	return result;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * Feel free to modify this pattern to include more paths.
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
	],
};
