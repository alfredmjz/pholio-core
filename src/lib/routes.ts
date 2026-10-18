export const AUTH_ROUTES = ["/login", "/confirm", "/welcome", "/error", "/auth/callback"];

export const PUBLIC_ROUTES = ["/login", "/confirm", "/welcome", "/error", "/auth/callback", "/api/auth", "/api/cron"];

export function isAuthRoute(pathname: string): boolean {
	return AUTH_ROUTES.some((route) => pathname.includes(route));
}

/**
 * Check if route is public (doesn't require auth).
 */
export function isPublicRoute(pathname: string): boolean {
	return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}
