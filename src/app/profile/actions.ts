"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Update user profile (full name)
 */
export async function updateProfile(formData: FormData) {
	try {
		const supabase = await createClient();

		// Get current user
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return { error: "You must be logged in" };
		}

		const fullName = formData.get("fullName") as string;

		// Sanitize input - remove HTML tags and trim
		const sanitizedName = fullName.trim().replace(/[<>]/g, ""); // Remove < and > to prevent XSS

		if (!sanitizedName || sanitizedName.length === 0) {
			return { error: "Name is required" };
		}

		if (sanitizedName.length > 255) {
			return { error: "Name must be less than 255 characters" };
		}

		// Update profile
		const { error: updateError } = await supabase
			.from("users")
			.update({ full_name: sanitizedName, updated_at: new Date().toISOString() })
			.eq("id", user.id);

		if (updateError) {
			console.error("Profile update error:", updateError);
			return { error: "Failed to update profile" };
		}

		revalidatePath("/profile");
		return { success: true, message: "Profile updated successfully" };
	} catch (error) {
		console.error("Unexpected error in updateProfile:", error);
		return { error: "An unexpected error occurred" };
	}
}

/**
 * Change user password
 */
export async function changePassword(formData: FormData) {
	try {
		const supabase = await createClient();

		// Get current user
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return { error: "You must be logged in" };
		}

		// Check if user is guest
		const { data: profile } = await supabase.from("users").select("is_guest").eq("id", user.id).single();

		if (profile?.is_guest) {
			return { error: "Guest accounts cannot change passwords. Please create a full account first." };
		}

		const currentPassword = formData.get("currentPassword") as string;
		const newPassword = formData.get("newPassword") as string;
		const confirmPassword = formData.get("confirmPassword") as string;

		// Validation
		if (!currentPassword || !newPassword || !confirmPassword) {
			return { error: "All fields are required" };
		}

		if (newPassword !== confirmPassword) {
			return { error: "New passwords do not match" };
		}

		if (newPassword.length < 8) {
			return { error: "New password must be at least 8 characters" };
		}

		if (newPassword === currentPassword) {
			return { error: "New password must be different from current password" };
		}

		// Verify current password by attempting sign in
		const { error: verifyError } = await supabase.auth.signInWithPassword({
			email: user.email!,
			password: currentPassword,
		});

		if (verifyError) {
			return { error: "Current password is incorrect" };
		}

		// Update password
		const { error: updateError } = await supabase.auth.updateUser({
			password: newPassword,
		});

		if (updateError) {
			console.error("Password update error:", updateError);
			return { error: updateError.message || "Failed to update password" };
		}

		return { success: true, message: "Password updated successfully" };
	} catch (error) {
		console.error("Unexpected error in changePassword:", error);
		return { error: "An unexpected error occurred" };
	}
}

/**
 * Change user email
 */
export async function changeEmail(formData: FormData) {
	try {
		const supabase = await createClient();

		// Get current user
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return { error: "You must be logged in" };
		}

		// Check if user is guest
		const { data: profile } = await supabase.from("users").select("is_guest").eq("id", user.id).single();

		if (profile?.is_guest) {
			return { error: "Guest accounts cannot change email. Please create a full account first." };
		}

		const newEmail = formData.get("newEmail") as string;
		const currentPassword = formData.get("currentPassword") as string;

		// Validation
		if (!newEmail || !currentPassword) {
			return { error: "All fields are required" };
		}

		// Email validation (more robust regex)
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		if (!emailRegex.test(newEmail)) {
			return { error: "Please enter a valid email address" };
		}

		if (newEmail === user.email) {
			return { error: "New email must be different from current email" };
		}

		// Verify current password
		const { error: verifyError } = await supabase.auth.signInWithPassword({
			email: user.email!,
			password: currentPassword,
		});

		if (verifyError) {
			return { error: "Current password is incorrect" };
		}

		// Update email (Supabase will send verification email automatically)
		const { error: updateError } = await supabase.auth.updateUser({
			email: newEmail,
		});

		if (updateError) {
			console.error("Email update error:", updateError);

			// Check for specific error messages
			if (updateError.message.includes("already registered")) {
				return { error: "This email is already registered" };
			}

			return { error: updateError.message || "Failed to update email" };
		}

		return {
			success: true,
			message: "Verification email sent to " + newEmail + ". Please check your inbox to confirm the change.",
		};
	} catch (error) {
		console.error("Unexpected error in changeEmail:", error);
		return { error: "An unexpected error occurred" };
	}
}
