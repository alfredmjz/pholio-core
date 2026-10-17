"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Logger } from "@/lib/logger";

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

	const origin =
		(await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
 * Signs out the current user and redirects to login page.
 */
export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath("/", "layout");
}
