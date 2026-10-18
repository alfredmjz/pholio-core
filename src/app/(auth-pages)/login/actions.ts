"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { Logger } from "@/lib/logger";
import { DEMO_COOKIE, DEMO_COOKIE_MAX_AGE } from "@/lib/demo-mode";
import { DEMO_SESSION_COOKIE, createDemoSession } from "@/lib/demo-session";

const MAGIC_LINK_REDIRECT_PATH = "/confirm?next=/dashboard";

/**
 * Sends a magic link to the provided email address.
 *
 * Works for both new and existing accounts: a first-time email creates the
 * account, and an existing email signs the user into their current account
 * (no data loss). This is the only sign-in method.
 *
 * @param formData - Form data containing the email field
 * @returns Error object if sending fails, success message otherwise
 */
export async function sendMagicLink(formData: FormData) {
	const supabase = await createClient();

	const email = (formData.get("email") as string).trim().toLowerCase();

	if (!email) {
		return { error: "Email is required" };
	}

	const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

	const { error } = await supabase.auth.signInWithOtp({
		email,
		options: {
			emailRedirectTo: `${origin}${MAGIC_LINK_REDIRECT_PATH}`,
		},
	});

	if (error) {
		Logger.error("Magic link send failed", { error });
		return { error: error.message };
	}

	return { success: "Magic link sent" };
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
