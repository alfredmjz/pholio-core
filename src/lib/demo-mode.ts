export const DEMO_COOKIE = "PHOLIO_DEMO_EXPIRED_SESSION";
export const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

/**
 * Request header the middleware sets on demo requests. Server code uses it to
 * serve sample data without relying on a cookie that any visitor can set by hand.
 */
export const DEMO_HEADER = "x-pholio-demo";

/**
 * Clears the demo-mode UI marker. The authoritative demo session is an
 * httpOnly cookie cleared by the `endDemo`/`signOut` server actions.
 * Client-only (no-op on the server).
 */
export function clearDemoModeCookie(): void {
	if (typeof document === "undefined") return;
	document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * Checks whether the demo-mode UI marker is currently set. This only controls
 * demo chrome/toasts; route access is guarded by the signed demo session.
 * Client-only (returns false on the server).
 */
export function isDemoModeActive(): boolean {
	if (typeof document === "undefined") return false;
	return document.cookie.split(";").some((part) => part.trim() === `${DEMO_COOKIE}=1`);
}

/**
 * Client counterpart of `isSampleDataMode()`: true when the server is serving sample data,
 * either for a demo session or because of the build-time sample-data flag (`dev:mock`).
 * In that mode mutations are kept in the in-browser demo store (`@/lib/demo-store`).
 * Client-only for the demo session (the flag alone is readable everywhere).
 */
export function isSampleDataActive(): boolean {
	return process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true" || isDemoModeActive();
}
