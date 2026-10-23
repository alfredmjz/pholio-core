"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { Logger } from "@/lib/logger";
import { DEMO_COOKIE, DEMO_COOKIE_MAX_AGE } from "@/lib/demo-mode";
import { DEMO_SESSION_COOKIE, createDemoSession } from "@/lib/demo-session";
import { getClientIp, limitMessage, normalizeEmail } from "@/lib/magic-link-limit";
import { claimMagicLinkSend, releaseMagicLinkSend, type MagicLinkClaim } from "@/lib/magic-link-limit.server";

const MAGIC_LINK_REDIRECT_PATH = "/confirm?next=/dashboard";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SendMagicLinkResult =
	| { success: string; retryAfterSeconds: number }
	| { error: string; retryAfterSeconds?: number };

/**
 * Sends (or resends) a magic link to the provided email address.
 *
 * Works for both new and existing accounts: a first-time email creates the
 * account, and an existing email signs the user into their current account
 * (no data loss). This is the only sign-in method.
 *
 * The send limits (60 s apart, 5 per email and 20 per IP per hour) are checked
 * and recorded in the database before Supabase is asked to send, so nothing the
 * browser sends can skip them. `retryAfterSeconds` is how long until the next
 * link is allowed; the page only displays it.
 *
 * @param formData - Form data containing the email field
 */
export async function sendMagicLink(formData: FormData): Promise<SendMagicLinkResult> {
	const rawEmail = formData.get("email");
	const email = typeof rawEmail === "string" ? normalizeEmail(rawEmail) : "";

	if (!email) {
		return { error: "Email is required" };
	}
	if (!EMAIL_PATTERN.test(email)) {
		return { error: "That email address doesn't look right." };
	}

	const requestHeaders = await headers();

	let claim: MagicLinkClaim;
	try {
		claim = await claimMagicLinkSend(email, getClientIp(requestHeaders));
	} catch (error) {
		// Fail closed: without the check, no email goes out.
		Logger.error("Magic link limit check failed", { error });
		return { error: "We couldn't send a link right now. Try again in a moment." };
	}

	if (!claim.allowed) {
		return { error: limitMessage(claim.reason, claim.retryAfterSeconds), retryAfterSeconds: claim.retryAfterSeconds };
	}

	const origin = requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

	const supabase = await createClient();
	const { error } = await supabase.auth.signInWithOtp({
		email,
		options: {
			emailRedirectTo: `${origin}${MAGIC_LINK_REDIRECT_PATH}`,
		},
	});

	if (error) {
		Logger.error("Magic link send failed", { error });
		// No email went out, so this attempt doesn't count against the user.
		await releaseMagicLinkSend(claim.sendId).catch((releaseError) =>
			Logger.error("Releasing magic link send failed", { error: releaseError })
		);
		return { error: error.message };
	}

	return { success: "Magic link sent", retryAfterSeconds: claim.retryAfterSeconds };
}

/**
 * Starts a demo session.
 *
 * The signed, httpOnly session cookie is only issued here — the "Try the demo"
 * button calls this action — so demo access cannot be obtained by setting the
 * public `PHOLIO_DEMO_EXPIRED_SESSION` cookie by hand.
 */
export async function startDemo() {
	const token = await createDemoSession();
	if (!token) {
		Logger.error("Demo session could not be created: set DEMO_SESSION_SECRET or SUPABASE_SECRET_KEY");
		return { error: "Demo mode is not available right now." };
	}

	const cookieStore = await cookies();
	const options = {
		path: "/",
		maxAge: DEMO_COOKIE_MAX_AGE,
		sameSite: "lax" as const,
	};

	cookieStore.set(DEMO_SESSION_COOKIE, token, { ...options, httpOnly: true });
	cookieStore.set(DEMO_COOKIE, "1", options);

	revalidatePath("/", "layout");

	return { success: true };
}

/**
 * Ends the demo session.
 */
export async function endDemo() {
	const cookieStore = await cookies();
	cookieStore.delete(DEMO_SESSION_COOKIE);
	cookieStore.delete(DEMO_COOKIE);

	revalidatePath("/", "layout");
}

/**
 * Signs out the current user and redirects to login page.
 */
export async function signOut() {
	const cookieStore = await cookies();
	cookieStore.delete(DEMO_SESSION_COOKIE);
	cookieStore.delete(DEMO_COOKIE);

	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath("/", "layout");
}
