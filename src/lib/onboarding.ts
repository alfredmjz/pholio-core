export const NAME_MAX_LENGTH = 255;

/** A trimmed display name with angle brackets removed, or why it can't be saved. */
export function cleanFullName(raw: unknown): { name: string; error?: undefined } | { name?: undefined; error: string } {
	const name = typeof raw === "string" ? raw.trim().replace(/[<>]/g, "") : "";
	if (!name) return { error: "Enter your name" };
	if (name.length > NAME_MAX_LENGTH) return { error: `Keep your name under ${NAME_MAX_LENGTH} characters` };
	return { name };
}

/** Someone without a name hasn't finished setting up their account. */
export function needsOnboarding(profile: { full_name?: string | null } | null | undefined): boolean {
	return Boolean(profile) && !profile?.full_name?.trim();
}

/** Only same-site paths, so a sign-in link can't send someone to another site. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
	if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
	return next;
}

export function onboardingPath(next: string): string {
	return next === "/dashboard" ? "/welcome" : `/welcome?next=${encodeURIComponent(next)}`;
}
