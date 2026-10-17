export const DEMO_COOKIE = "pholio_demo";

const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

/**
 * Sets the demo-mode cookie. Used by the "Try the demo" entry point.
 * Client-only (no-op on the server).
 */
export function setDemoModeCookie(): void {
	if (typeof document === "undefined") return;
	document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=${DEMO_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Clears the demo-mode cookie. Used when the user signs out or signs up.
 * Client-only (no-op on the server).
 */
export function clearDemoModeCookie(): void {
	if (typeof document === "undefined") return;
	document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * Checks whether the demo-mode cookie is currently set.
 * Client-only (returns false on the server).
 */
export function isDemoModeActive(): boolean {
	if (typeof document === "undefined") return false;
	return document.cookie.split(";").some((part) => part.trim() === `${DEMO_COOKIE}=1`);
}
