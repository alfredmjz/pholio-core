/**
 * JWT Middleware for Supabase Authentication
 * Eliminates timeout issues in authentication flow
 */

import { jwtVerify, type JWTPayload } from "jose";

/**
 * Verify Supabase JWT token locally using jose library
 * This is MUCH faster (1-2ms vs 200-300ms API call)
 */
export async function verifySupabaseJWT(token: string): Promise<JWTPayload | null> {
	try {
		const secret = new TextEncoder().encode(
			process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET ||
			process.env.SUPABASE_JWT_SECRET ||
			""
		);
		
		const { payload } = await jwtVerify(token, secret, {
			issuer: `https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')}`,
			audience: 'authenticated',
		});
		
		return payload;
	} catch (error) {
		console.debug("[JWT Verification] Invalid token:", error);
		return null;
	}
}

/**
 * Get access token from request cookies
 */
export function getAccessTokenFromRequest(request: any): string | null {
	const accessToken = request.cookies.get('sb-access-token')?.value;
	if (accessToken) return accessToken;

	const sessionToken = request.cookies.get('sb-session-token')?.value;
	return sessionToken || accessToken;
}

/**
 * Check if route is public (doesn't require auth)
 */
export function isPublicRoute(pathname: string): boolean {
	const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/api/auth'];
	return publicRoutes.some(route => pathname.startsWith(route));
}
