import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySupabaseJWT, getAccessTokenFromRequest, isPublicRoute } from "./jwt-middleware";

/**
 * Fast path auth check using local JWT verification
 * Much faster than API calls (1-2ms vs 200-300ms)
 */
async function fastAuthCheck(request: NextRequest): Promise<{ userId: string | null; verified: boolean }> {
	const token = getAccessTokenFromRequest(request);

	if (!token) {
		return { userId: null, verified: false };
	}

	const payload = await verifySupabaseJWT(token);

	return {
		userId: payload?.sub || null,
		verified: payload !== null,
	};
}

/**
 * Middleware to handle Supabase session management
 * - Refreshes expired auth tokens
 * - Protects routes that require authentication
 */
export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request });

	const pathname = request.nextUrl.pathname;

	// Skip auth when using sample/mock data (for development/demos)
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return supabaseResponse;
	}

	// Allow public routes without auth
	if (isPublicRoute(pathname)) {
		return supabaseResponse;
	}

	// Create Supabase client for session handling
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
					supabaseResponse = NextResponse.next({ request });
					cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
				},
			},
		}
	);

	// Try fast JWT verification first
	const { userId, verified } = await fastAuthCheck(request);

	if (verified && userId) {
		// JWT verified - user is authenticated
		// Refresh session in background (non-blocking)
		supabase.auth.getUser().catch(() => {});
		return supabaseResponse;
	}

	// JWT verification failed - fall back to API check with timeout
	try {
		const result = await Promise.race([
			supabase.auth.getUser(),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 5000)),
		]);

		const {
			data: { user },
			error,
		} = result as Awaited<ReturnType<typeof supabase.auth.getUser>>;

		if (!error && user) {
			return supabaseResponse;
		}
	} catch {
		// Timeout or error - redirect to login
	}

	// Not authenticated - redirect to login
	const loginUrl = new URL("/login", request.url);
	return NextResponse.redirect(loginUrl);
}
