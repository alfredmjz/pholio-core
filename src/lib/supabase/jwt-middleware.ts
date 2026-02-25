import {
	jwtVerify,
	createRemoteJWKSet,
	decodeProtectedHeader,
	decodeJwt,
	type JWTPayload,
	type JWTVerifyGetKey,
} from "jose";
import type { NextRequest } from "next/server";
import { Logger } from "@/lib/logger";

/**
 * Decodes the JWT payload without verifying the signature.
 * Useful for checking expiration/claims in middleware "fast-path".
 */
export function decodeJWTPayload(token: string): JWTPayload | null {
	try {
		return decodeJwt(token);
	} catch {
		return null;
	}
}

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

export async function verifySupabaseJWT(
	token: string
): Promise<{ payload: JWTPayload | null; error?: string; isTimeout?: boolean }> {
	// Skip verification for mock/sample data mode - return mock payload
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return { payload: { sub: "mock-user-id", aud: "authenticated" } };
	}

	try {
		// Quick check for token algorithm using jose's built-in decoder
		const header = decodeProtectedHeader(token);

		// If it's HS256 (default for many Supabase projects), JWKS won't work
		// We return null to fall back to the slower but reliable API check.
		if (header.alg === "HS256") {
			return { payload: null, error: "HS256_NOT_SUPPORTED" };
		}

		const JWKS = getJWKS();

		// Race verification against a 3-second timeout to keep things snappy
		const verified = await Promise.race([
			jwtVerify(token, JWKS, {
				audience: "authenticated",
				clockTolerance: 60, // 60 seconds leeway for clock skew
			}).then((res) => ({ payload: res.payload, isTimeout: false })),
			new Promise<{ payload: null; isTimeout: true }>((resolve) =>
				setTimeout(() => resolve({ payload: null, isTimeout: true }), 3000)
			),
		]);

		if (verified.isTimeout) {
			Logger.warn("[verifySupabaseJWT] Signature verification TIMED OUT (3s)");
			return { payload: null, isTimeout: true };
		}

		return { payload: verified.payload };
	} catch (err: any) {
		// Catch "Unsupported alg" and other library-specific errors silently
		if (err.code === "ERR_JOSE_NOT_SUPPORTED" || err.code === "ERR_JOSE_GENERIC") {
			return { payload: null, error: "ALGO_NOT_SUPPORTED" };
		}

		if (err.code === "ERR_JWT_EXPIRED") {
			return { payload: null, error: "EXPIRED" };
		}

		if (err.code === "ERR_JWS_INVALID" || err.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
			Logger.warn("[verifySupabaseJWT] Failed: invalid signature or format", { code: err.code });
			return { payload: null, error: "INVALID" };
		}

		Logger.error("[verifySupabaseJWT] Unexpected verification error", { error: err.message, code: err.code });
		return { payload: null, error: err.message };
	}
}

/**
 * Extract access token from Supabase auth cookies
 * Handles both plain JSON and base64-encoded cookie formats
 */
export function getAccessTokenFromRequest(request: NextRequest): { token: string | null; staleCookieNames: string[] } {
	const allCookies = request.cookies.getAll();

	// Helper to extract access_token from a raw cookie string (might be JSON or encoded)
	const extractToken = (val: string): string | null => {
		let processed = val;
		if (processed.startsWith("base64-")) {
			try {
				processed = atob(processed.slice(7));
			} catch {
				return null;
			}
		}

		try {
			const data = JSON.parse(processed);
			return data?.access_token || null;
		} catch {
			return null;
		}
	};

	// Helper to check if a token is expired locally
	const isTokenValidLocally = (token: string): boolean => {
		try {
			const payload = decodeJWTPayload(token);
			if (!payload?.exp) return false;
			const now = Math.floor(Date.now() / 1000);
			return payload.exp > now + 10; // 10s buffer
		} catch {
			return false;
		}
	};

	const items: Array<{ token: string; cookies: string[]; isValid: boolean }> = [];

	// 1. Check for single auth token cookies
	const singleCookies = allCookies.filter((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
	for (const cookie of singleCookies) {
		const token = extractToken(cookie.value);
		if (token) {
			items.push({
				token,
				cookies: [cookie.name],
				isValid: isTokenValidLocally(token),
			});
		}
	}

	// 2. Check for chunked cookies
	const chunks: Map<string, Array<{ name: string; value: string }>> = new Map();
	for (const cookie of allCookies) {
		const match = cookie.name.match(/^(sb-.*-auth-token)\.(\d+)$/);
		if (match) {
			const baseName = match[1];
			const index = parseInt(match[2], 10);
			if (!chunks.has(baseName)) chunks.set(baseName, []);
			chunks.get(baseName)![index] = { name: cookie.name, value: cookie.value };
		}
	}

	for (const [baseName, cookieParts] of Array.from(chunks.entries())) {
		const validParts = cookieParts.filter(Boolean);
		if (validParts.length === 0) continue;

		const combined = validParts.map((p) => p.value).join("");
		const token = extractToken(combined);
		if (token) {
			items.push({
				token,
				cookies: validParts.map((p) => p.name),
				isValid: isTokenValidLocally(token),
			});
		}
	}

	if (items.length === 0) {
		return { token: null, staleCookieNames: [] };
	}

	// Prioritize valid tokens
	const bestItem = items.find((i) => i.isValid) || items[0];

	// Identify stale cookies: every cookie that doesn't belong to the "best" token
	const staleCookieNames: string[] = [];
	for (const item of items) {
		if (item === bestItem) continue;
		staleCookieNames.push(...item.cookies);
	}

	if (items.length > 1) {
		Logger.info("[getAccessToken] Cleaned up Redundant/Stale session cookies", {
			count: items.length,
			clearing: staleCookieNames.length,
		});
	}

	return { token: bestItem.token, staleCookieNames };
}

/**
 * Check if route is public (doesn't require auth)
 */
export function isPublicRoute(pathname: string): boolean {
	const publicRoutes = [
		"/login",
		"/signup",
		"/forgot-password",
		"/reset-password",
		"/auth/callback",
		"/api/auth",
		"/api/cron",
	];
	return publicRoutes.some((route) => pathname.startsWith(route));
}
