import { createHash } from "node:crypto";

/** Why the server refused a magic link (see `claim_magic_link_send` in migration 020). */
export type MagicLinkLimitReason = "cooldown" | "email_limit" | "ip_limit";

/** Lower-cased and trimmed, so "Me@Example.com " and "me@example.com" share one limit. */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/** SHA-256 hex digest. The limit table stores only these, never the raw email or IP. */
export function hashIdentifier(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/**
 * The visitor's IP from the proxy headers. Vercel overwrites `x-forwarded-for` and `x-real-ip`
 * with the real client address, so a browser can't spoof them in production.
 */
export function getClientIp(headers: Pick<Headers, "get">): string {
	const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	if (forwarded) return forwarded;
	const realIp = headers.get("x-real-ip")?.trim();
	return realIp || "unknown";
}

/** Whole minutes, rounded up so "Try again in 1 minute" never arrives early. */
function minutesLabel(seconds: number): string {
	const minutes = Math.max(1, Math.ceil(seconds / 60));
	return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** The message shown when the server refuses a link. */
export function limitMessage(reason: MagicLinkLimitReason, retryAfterSeconds: number): string {
	switch (reason) {
		case "cooldown": {
			const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
			return `Wait ${seconds} ${seconds === 1 ? "second" : "seconds"} before asking for another link.`;
		}
		case "email_limit":
			return `You've asked for 5 links in the last hour. Try again in ${minutesLabel(retryAfterSeconds)}.`;
		case "ip_limit":
			return `Too many sign-in links from this network. Try again in ${minutesLabel(retryAfterSeconds)}.`;
	}
}
