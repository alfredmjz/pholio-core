"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Logger } from "@/lib/logger";

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

	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		Logger.error("Login failed", { error });
		return { error: error.message };
	}

	if (data.user && !data.user.email_confirmed_at) {
		await supabase.auth.signOut();
		return { error: "Please verify your email address before logging in." };
	}

	// Check if this is the user's first login (hasn't seen welcome)
	// Only show welcome for registered users, not guests
	let showWelcome = false;
	const { data: profile } = await supabase
		.from("users")
		.select("has_seen_welcome, is_guest")
		.eq("id", data.user.id)
		.single();

	// has_seen_welcome could be null (for existing users before migration) - treat as false
	if (profile && profile.has_seen_welcome !== true && !profile.is_guest) {
		showWelcome = true;
		// Mark as seen
		await supabase.from("users").update({ has_seen_welcome: true }).eq("id", data.user.id);
	}

	revalidatePath("/", "layout");
	return { showWelcome };
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
		// Map Supabase errors to user-friendly messages
		// Production settings: 8 chars minimum, requires lowercase, uppercase, digits, and symbols
		const errorMessages: Record<string, string> = {
			"User already registered": "An account with this email already exists. Please log in instead.",
			"Email rate limit exceeded": "Too many signup attempts. Please try again later.",
			"Password should be at least 8 characters": "Password must be at least 8 characters long.",
			"Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{}|'":
				"Password must include lowercase, uppercase, number, and symbol.",
			"Signup requires a valid password": "Please enter a valid password.",
			"Unable to validate email address: invalid format": "Please enter a valid email address.",
			"Anonymous sign-ins are disabled": "Guest access is currently unavailable.",
		};

		const friendlyMessage = errorMessages[authError.message] || authError.message;
		return { error: friendlyMessage };
	}

	if (!authData.user) {
		return { error: "Failed to create user account" };
	}

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
	const supabase = await createClient();

	const { data, error } = await supabase.auth.signInAnonymously();

	if (error) {
		Logger.error("Guest signInAnonymously failed", { error });
		return { error: error.message };
	}

	if (!data.user) {
		Logger.error("Guest login: No user returned from signInAnonymously");
		return { error: "Failed to create guest session" };
	}

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
			Logger.error("Failed to create guest profile", { error: insertError });
		}
	}

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
