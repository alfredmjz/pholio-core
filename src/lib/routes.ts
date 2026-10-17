export const AUTH_ROUTES = ["/login", "/confirm", "/welcome", "/error", "/auth/callback"];

export function isAuthRoute(pathname: string): boolean {
	return AUTH_ROUTES.some((route) => pathname.includes(route));
}
