import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySupabaseJWT, getAccessTokenFromRequest, isPublicRoute, decodeJWTPayload } from "./jwt-middleware";
import { Logger } from "@/lib/logger";

/**
 * Fast path auth check using local JWT verification
 * Much faster than API calls (1-2ms vs 200-300ms)
 */
async function fastAuthCheck(request: NextRequest): Promise<{
	userId: string | null;
	verified: boolean;
	isExpired: boolean;
	isTimeout: boolean;
	staleCookieNames: string[];
}> {
	const { token, staleCookieNames } = getAccessTokenFromRequest(request);

	if (!token) {
		return { userId: null, verified: false, isExpired: true, isTimeout: false, staleCookieNames };
	}

	// Try full verification (signature check)
	const { payload, isTimeout } = await verifySupabaseJWT(token);
	if (payload) {
		return { userId: payload.sub || null, verified: true, isExpired: false, isTimeout: false, staleCookieNames };
	}

	// Signature verification failed or skipped (HS256) or timed out
	// Check expiration via decode-only for "best-effort" local check
	const decoded = decodeJWTPayload(token);
	const now = Math.floor(Date.now() / 1000);
	const isExpired = decoded?.exp ? decoded.exp < now : true;

	return {
		userId: decoded?.sub || null,
		verified: false,
		isExpired,
		isTimeout: !!isTimeout,
		staleCookieNames,
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
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

	// Try fast JWT verification first (Local Signature Check)
	const { userId, verified, isExpired, isTimeout, staleCookieNames } = await fastAuthCheck(request);

	// Clean up stale cookies if found
	if (staleCookieNames.length > 0) {
		staleCookieNames.forEach((name) => {
			supabaseResponse.cookies.delete(name);
		});
	}

	if (verified && userId) {
		// JWT verified via JWKS - user is authenticated securely
		// Refresh session in background (non-blocking)
		supabase.auth.getUser().catch(() => {});
		return supabaseResponse;
	}

	// DEV EMERGENCY BYPASS: If signature verification timed out but the token is locally valid,
	// let them through in development mode to avoid the 10s API fallback hang.
	if (process.env.NODE_ENV === "development" && isTimeout && !isExpired && userId) {
		Logger.warn(
			"[updateSession] Dev Emergency Bypass: Signature timed out but token is locally valid. Letting user through."
		);
		// Start authoritative check in background
		supabase.auth.getUser().catch(() => {});
		return supabaseResponse;
	}

	// Local signature verification failed or skipped (e.g. HS256)
	// Fall back to authoritative API check with timeout
	try {
		// Add timeout to prevent hanging and redirect loops
		const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>((resolve) =>
			setTimeout(() => resolve({ data: { user: null }, error: new Error("Auth timeout (10s)") }), 10000)
		);

		const result = await Promise.race([supabase.auth.getUser(), timeoutPromise]);

		const {
			data: { user },
			error,
		} = result;

		if (!error && user) {
			return supabaseResponse;
		}

		if (error) {
			// Emergency Fallback: If it's specifically a TIMEOUT, and we have a local unexpired token,
			// let them through for routing stability. This is safer than the upfront bypass.
			if (error.message.includes("timeout") && !isExpired && userId) {
				Logger.warn("[updateSession] Auth API timeout caught, falling back to unexpired local JWT", { userId });
				return supabaseResponse;
			}
			Logger.error("[updateSession] Authoritative API check FAILED", { error: error.message });
		}
	} catch (err: any) {
		Logger.error("Auth fallback check failed", { error: err.message });
	}

	// Not authenticated or API rejected session - redirect to login
	const loginUrl = new URL("/login", request.url);
	return NextResponse.redirect(loginUrl);
}
