import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySupabaseJWT, getAccessTokenFromRequest, isPublicRoute } from "./jwt-middleware";

/**
 * Fast path auth check - uses local JWT verification
 * This is MUCH faster (1-2ms vs 200-300ms API call)
 */
async function fastAuthCheck(request: NextRequest): Promise<{ userId: string | null; verified: boolean }> {
	const token = getAccessTokenFromRequest(request);
	
	if (!token) {
		return { userId: null, verified: false };
	}

	const verified = await verifySupabaseJWT(token);
	
	return {
		userId: verified?.sub || null,
		verified: verified !== null,
	};
}

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	// Check if route is public
	const pathname = request.nextUrl.pathname;
	if (isPublicRoute(pathname)) {
		return supabaseResponse;
	}

	// Fast JWT verification for protected routes
	const { userId, verified } = await fastAuthCheck(request);

	if (!verified || !userId) {
		console.log("[Middleware] User not authenticated, redirecting to login");
		const loginUrl = new URL('/login', request.url);
		return NextResponse.redirect(loginUrl);
	}

	// User is authenticated, continue with session refresh
	// This is optional and can be done lazily in the background
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
				},
			},
		}
	);

	// Try to refresh session in background (non-blocking)
	try {
		await Promise.race([
			supabase.auth.getUser(),
			new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
		]);
	} catch (error) {
		// Timeout or error is okay - we already verified with JWT
		console.debug("[Middleware] Session refresh skipped:", error instanceof Error ? error.message : 'Unknown error');
	}

	return supabaseResponse;
}
