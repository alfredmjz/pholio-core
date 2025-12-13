"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

/**
 * Authenticates a user with email and password.
 *
 * @param formData - Form data containing email and password fields
 * @returns Error object if authentication fails, redirects to home on success
 */
export async function login(formData: FormData) {
	const supabase = await createClient();

	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	console.log("[Login Action] Attempting sign in...");
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		console.error("[Login Action] Error:", error.message);
		return { error: error.message };
	}

	console.log("[Login Action] Sign in successful. Checking email confirmation...");

	if (data.user && !data.user.email_confirmed_at) {
		console.warn("[Login Action] Email not confirmed.");
		await supabase.auth.signOut();
		return { error: "Please verify your email address before logging in." };
	}

	console.log("[Login Action] Login successful");
	revalidatePath("/", "layout");
	return { success: "Logged in successfully" };
}

/**
 * Registers a new user account.
 *
 * Creates authentication user and profile record via database trigger.
 * Updates full_name separately as trigger only sets id and email.
 *
 * @param formData - Form data containing email, password, and optional fullName
 * @returns Error object if registration fails, redirects to success page on completion
 */
export async function signup(formData: FormData) {
	const supabase = await createClient();
	const origin = (await headers()).get("origin");

	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const fullName = formData.get("fullName") as string | null;

	// Database trigger automatically creates profile on auth.signUp
	const { data: authData, error: authError } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo: `${origin}/auth/callback?next=/`,
			data: {
				full_name: fullName,
			},
		},
	});

	if (authError) {
		return { error: authError.message };
	}

	if (!authData.user) {
		return { error: "Failed to create user account" };
	}

	if (fullName) {
		// Wait for trigger to complete before updating
		await new Promise((resolve) => setTimeout(resolve, 100));

		const { error: updateError } = await supabase
			.from("users")
			.update({ full_name: fullName })
			.eq("id", authData.user.id);

		if (updateError) {
			console.error("Failed to update full name:", updateError);
		}
	}

	console.log("[Signup Action] Account created. Returning redirect URL.");
	revalidatePath("/", "layout");
	return { success: "Account created", redirectUrl: `/signup/success?email=${encodeURIComponent(email)}` };
}

/**
 * Resends the confirmation email to the user.
 *
 * @param email - The email address to resend the confirmation to
 * @returns Error object if resend fails, message on success
 */
export async function resendConfirmationEmail(email: string) {
	const supabase = await createClient();

	const origin = (await headers()).get("origin");

	const { error } = await supabase.auth.resend({
		type: "signup",
		email,
		options: {
			emailRedirectTo: `${origin}/auth/callback?next=/`,
		},
	});

	if (error) {
		return { error: error.message };
	}

	return { success: "Confirmation email sent" };
}

/**
 * Creates an anonymous guest session.
 *
 * Generates guest user with random name. Creates profile manually if database
 * trigger fails.
 *
 * @returns Error object if guest creation fails, success message on completion
 */
export async function loginAsGuest() {
	console.log("[Guest Login] Starting guest session creation...");
	const supabase = await createClient();

	const { data, error } = await supabase.auth.signInAnonymously();

	if (error) {
		console.error("[Guest Login] signInAnonymously failed:", error.message);
		return { error: error.message };
	}

	if (!data.user) {
		console.error("[Guest Login] No user returned from signInAnonymously");
		return { error: "Failed to create guest session" };
	}

	console.log("[Guest Login] Session created for user:", data.user.id);

	// Wait for database trigger to create profile
	await new Promise((resolve) => setTimeout(resolve, 200));

	const { data: existingProfile, error: profileError } = await supabase
		.from("users")
		.select("id")
		.eq("id", data.user.id)
		.maybeSingle();

	// Fallback: Create profile manually if trigger failed
	if (!existingProfile && !profileError) {
		const guestNames = [
			"Wandering Traveler",
			"Mystery Guest",
			"Anonymous Visitor",
			"Curious Explorer",
			"Digital Nomad",
			"Silent Observer",
			"Phantom User",
			"Shadow Walker",
		];
		const randomGuestName = guestNames[Math.floor(Math.random() * guestNames.length)];

		const { error: insertError } = await supabase.from("users").insert({
			id: data.user.id,
			email: data.user.email || `guest-${data.user.id}@pholio.local`,
			is_guest: true,
			guest_name: randomGuestName,
		});

		if (insertError) {
			console.error("Failed to create guest profile:", insertError);
		}
	}

	console.log("[Guest Login] Session created successfully");
	revalidatePath("/", "layout");
	return { success: "Guest session created" };
}

/**
 * Signs out the current user and redirects to login page.
 */
export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath("/", "layout");
}
