/**
 * JWT Middleware for Supabase Authentication
 * Provides fast local JWT verification to avoid API timeouts
 */

import { jwtVerify, type JWTPayload } from "jose";

/**
 * Verify Supabase JWT token locally using jose library
 * This is MUCH faster (1-2ms vs 200-300ms API call)
 *
 * @param token - The JWT access token to verify
 * @returns The JWT payload if valid, null otherwise
 */
export async function verifySupabaseJWT(token: string): Promise<JWTPayload | null> {
	// Only use server-side secret (never expose in NEXT_PUBLIC_)
	const jwtSecret = process.env.SUPABASE_JWT_SECRET;

	if (!jwtSecret) {
		// Only allow insecure decode when using mock/sample data (no Supabase connection)
		if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
			console.warn("[JWT] No SUPABASE_JWT_SECRET - using insecure decode-only mode for sample data");
			return decodeJWTUnsafe(token);
		}

		// Real Supabase connection requires JWT secret
		console.error("[JWT] SUPABASE_JWT_SECRET is required when connecting to Supabase");
		return null;
	}

	try {
		const secret = new TextEncoder().encode(jwtSecret);
		const { payload } = await jwtVerify(token, secret, {
			audience: "authenticated",
		});
		return payload;
	} catch (error) {
		// Token invalid or expired
		return null;
	}
}

/**
 * Decode JWT without signature verification (DEVELOPMENT ONLY)
 * This allows routing to work without JWT secret, but is NOT secure
 */
function decodeJWTUnsafe(token: string): JWTPayload | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;

		// Decode base64url to base64, then decode
		const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
		const payload = JSON.parse(payloadJson) as JWTPayload;

		// Check if token is expired
		if (payload.exp && payload.exp < Date.now() / 1000) {
			return null;
		}

		// Must have a user ID
		return payload.sub ? payload : null;
	} catch {
		return null;
	}
}

/**
 * Extract access token from Supabase auth cookies
 * Handles both plain JSON and base64-encoded cookie formats
 */
export function getAccessTokenFromRequest(request: any): string | null {
	const allCookies = request.cookies.getAll();

	// Look for Supabase auth token cookie: sb-{project-ref}-auth-token
	for (const cookie of allCookies) {
		if (cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token")) {
			let cookieValue = cookie.value;

			// Handle base64-encoded cookies (Supabase SSR format)
			if (cookieValue.startsWith("base64-")) {
				try {
					cookieValue = atob(cookieValue.slice(7));
				} catch {
					continue;
				}
			}

			try {
				const sessionData = JSON.parse(cookieValue);
				if (sessionData?.access_token) {
					return sessionData.access_token;
				}
			} catch {
				// Not valid JSON, try next cookie
			}
		}
	}

	// Handle chunked cookies: sb-{project-ref}-auth-token.0, .1, etc.
	const chunkPattern = /^sb-.*-auth-token\.(\d+)$/;
	const chunks: { index: number; value: string }[] = [];

	for (const cookie of allCookies) {
		const match = cookie.name.match(chunkPattern);
		if (match) {
			chunks.push({ index: parseInt(match[1], 10), value: cookie.value });
		}
	}

	if (chunks.length > 0) {
		chunks.sort((a, b) => a.index - b.index);
		let combined = chunks.map((c) => c.value).join("");

		// Handle base64 prefix in chunked cookies
		if (combined.startsWith("base64-")) {
			try {
				combined = atob(combined.slice(7));
			} catch {
				return null;
			}
		}

		try {
			const sessionData = JSON.parse(combined);
			if (sessionData?.access_token) {
				return sessionData.access_token;
			}
		} catch {
			// Failed to parse
		}
	}

	return null;
}

/**
 * Check if route is public (doesn't require auth)
 */
export function isPublicRoute(pathname: string): boolean {
	const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/api/auth"];
	return publicRoutes.some((route) => pathname.startsWith(route));
}
