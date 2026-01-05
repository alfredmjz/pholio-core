/**
 * JWT Middleware for Supabase Authentication
 * Uses ES256 (ECC) verification via JWKS endpoint only
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { NextRequest } from "next/server";
import { Logger } from "@/lib/logger";

// Cache for JWKS to avoid repeated fetches
let cachedJWKS: JWTVerifyGetKey | null = null;

/**
 * Get the JWKS (JSON Web Key Set) for ES256 verification
 * Uses Supabase's standard JWKS endpoint
 */
function getJWKS(): JWTVerifyGetKey {
	if (cachedJWKS) {
		return cachedJWKS;
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (!supabaseUrl) {
		throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for JWKS verification");
	}

	// Supabase exposes JWKS at /auth/v1/.well-known/jwks.json
	const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
	cachedJWKS = createRemoteJWKSet(jwksUrl);
	return cachedJWKS;
}

/**
 * Verify Supabase JWT token using ES256 (ECC) via JWKS endpoint
 *
 * @param token - The JWT access token to verify
 * @returns The JWT payload if valid, null otherwise
 */
export async function verifySupabaseJWT(token: string): Promise<JWTPayload | null> {
	// Skip verification for mock/sample data mode - return mock payload
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return { sub: "mock-user-id", aud: "authenticated" };
	}

	try {
		const JWKS = getJWKS();

		// Race verification against a 2-second timeout to prevent hangs
		// (Common issue in some runtimes or network conditions)
		const { payload } = await Promise.race([
			jwtVerify(token, JWKS, { audience: "authenticated" }),
			new Promise<{ payload: any }>((_, reject) =>
				setTimeout(() => reject(new Error("Verification timed out (2s)")), 2000)
			),
		]);

		return payload;
	} catch (err) {
		Logger.debug("JWT verification failed", { error: err });
		return null;
	}
}

/**
 * Extract access token from Supabase auth cookies
 * Handles both plain JSON and base64-encoded cookie formats
 */
export function getAccessTokenFromRequest(request: NextRequest): string | null {
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
