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

	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return { error: error.message };
	}

	revalidatePath("/", "layout");
	redirect("/");
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

	// Check if current user is a guest
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (user) {
		const { data: profile } = await supabase.from("users").select("is_guest").eq("id", user.id).single();

		if (profile?.is_guest) {
			const { data: existingUser } = await supabase
				.from("users")
				.select("id")
				.eq("email", email)
				.neq("id", user.id)
				.single();
			if (existingUser) {
				return { error: "An account with this email already exists" };
			}

			const { error: updateAuthError } = await supabase.auth.updateUser(
				{
					email,
					password,
					data: { full_name: fullName },
				},
				{
					emailRedirectTo: `${origin}/auth/callback?next=/allocations`,
				}
			);

			if (updateAuthError) {
				return { error: updateAuthError.message };
			}

			const { error: updateProfileError } = await supabase
				.from("users")
				.update({
					email,
					is_guest: false,
					guest_name: null,
					full_name: fullName || null,
				})
				.eq("id", user.id);

			if (updateProfileError) {
				return { error: "Failed to update user profile" };
			}

			revalidatePath("/", "layout");
		}

		return { error: "You are already logged in." };
	}

	const { data: authData, error: authError } = await supabase.auth.signUp({
		email,
		password,
		options: {
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

	revalidatePath("/", "layout");
	redirect("/signup/success");
}

/**
 * Creates an anonymous guest session.
 *
 * Generates guest user with random name. Creates profile manually if database
 * trigger fails.
 *
 * @returns Error object if guest creation fails, redirects to home on success
 */
export async function loginAsGuest() {
	const supabase = await createClient();

	const { data, error } = await supabase.auth.signInAnonymously();

	if (error) {
		return { error: error.message };
	}

	if (!data.user) {
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
			console.error("Failed to create guest profile:", insertError);
		}
	}

	revalidatePath("/", "layout");
}

/**
 * Signs out the current user and redirects to login page.
 */
export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath("/", "layout");
}
