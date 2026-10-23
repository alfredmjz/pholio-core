/** What sits behind the app's pages. Saved per device in a cookie, so the server knows it on first render. */
export type BackdropPreference = "none" | "adaptive" | "wind";

export const BACKDROP_PREFERENCES: BackdropPreference[] = ["none", "adaptive", "wind"];
export const DEFAULT_BACKDROP: BackdropPreference = "adaptive";
export const BACKDROP_COOKIE = "pholio-backdrop";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseBackdropPreference(value: string | null | undefined): BackdropPreference {
	return BACKDROP_PREFERENCES.find((preference) => preference === value) ?? DEFAULT_BACKDROP;
}

export function backdropCookie(preference: BackdropPreference): string {
	return `${BACKDROP_COOKIE}=${preference}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
