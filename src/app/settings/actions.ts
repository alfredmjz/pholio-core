"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sampleProfile } from "@/mock-data/profile";
import { Logger } from "@/lib/logger";

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
			Logger.error("Profile update error", { error: updateError });
			return { error: "Failed to update profile" };
		}

		revalidatePath("/profile");
		return { success: true, message: "Profile updated successfully" };
	} catch (error) {
		Logger.error("Unexpected error in updateProfile", { error });
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
			Logger.error("Password update error", { error: updateError });
			return { error: updateError.message || "Failed to update password" };
		}

		return { success: true, message: "Password updated successfully" };
	} catch (error) {
		Logger.error("Unexpected error in changePassword", { error });
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
			Logger.error("Email update error", { error: updateError });

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
		Logger.error("Unexpected error in changeEmail", { error });
		return { error: "An unexpected error occurred" };
	}
}

/**
 * Upload profile avatar
 */
export async function uploadProfileAvatar(formData: FormData) {
	try {
		if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
			return { error: "Cannot upload avatar in demo mode" };
		}

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
			return { error: "Guest accounts cannot upload profile pictures" };
		}

		const avatarFile = formData.get("avatar") as File;

		if (!avatarFile) {
			return { error: "No image file provided" };
		}

		// Validate file size (max 5MB)
		if (avatarFile.size > 5 * 1024 * 1024) {
			return { error: "Image must be smaller than 5MB" };
		}

		// Validate file type
		if (!avatarFile.type.startsWith("image/")) {
			return { error: "File must be an image" };
		}

		// Define path: user_id/timestamp-avatar.png
		const timestamp = Date.now();
		const filePath = `${user.id}/${timestamp}-avatar.png`;

		// Upload to Supabase Storage
		const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, avatarFile, {
			contentType: avatarFile.type,
			upsert: false,
		});

		if (uploadError) {
			Logger.error("Storage upload error", { error: uploadError });
			return { error: "Failed to upload image. ensure the 'avatars' bucket exists and is public." };
		}

		// Get public URL
		const {
			data: { publicUrl },
		} = supabase.storage.from("avatars").getPublicUrl(filePath);

		// Update user profile with new avatar URL
		const { error: updateError } = await supabase
			.from("users")
			.update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
			.eq("id", user.id);

		if (updateError) {
			Logger.error("Profile avatar update error", { error: updateError });
			return { error: "Failed to update profile with new image" };
		}

		revalidatePath("/profile");
		revalidatePath("/settings"); // Revalidate settings page as well
		return { success: true, message: "Profile picture updated successfully" };
	} catch (error) {
		Logger.error("Unexpected error in uploadProfileAvatar", { error });
		return { error: "An unexpected error occurred" };
	}
}

// =============================================================================
// ALLOCATION SETTINGS
// =============================================================================

export type AllocationNewMonthDefault = "dialog" | "import_previous" | "template" | "fresh";

/**
 * Get user's allocation settings
 */
export async function getAllocationSettings(): Promise<{
	newMonthDefault: AllocationNewMonthDefault;
}> {
	// Handle sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return {
			newMonthDefault: (sampleProfile.allocation_new_month_default as AllocationNewMonthDefault) || "dialog",
		};
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { newMonthDefault: "dialog" };
		}

		const { data: profile } = await supabase
			.from("users")
			.select("allocation_new_month_default")
			.eq("id", user.id)
			.single();

		return {
			newMonthDefault: (profile?.allocation_new_month_default as AllocationNewMonthDefault) || "dialog",
		};
	} catch (error) {
		Logger.error("Error getting allocation settings", { error });
		return { newMonthDefault: "dialog" };
	}
}

/**
 * Update user's allocation settings
 */
export async function updateAllocationSettings(settings: {
	newMonthDefault?: AllocationNewMonthDefault;
}): Promise<{ success: boolean; error?: string }> {
	// Handle sample data mode
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return { success: true };
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "You must be logged in" };
		}

		const updates: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
		};

		if (settings.newMonthDefault) {
			// Validate the value
			const validOptions = ["dialog", "import_previous", "template", "fresh"];
			if (!validOptions.includes(settings.newMonthDefault)) {
				return { success: false, error: "Invalid setting value" };
			}
			updates.allocation_new_month_default = settings.newMonthDefault;
		}

		const { error } = await supabase.from("users").update(updates).eq("id", user.id);

		if (error) {
			Logger.error("Error updating allocation settings", { error });
			return { success: false, error: "Failed to update settings" };
		}

		revalidatePath("/settings");
		revalidatePath("/allocations");
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in updateAllocationSettings", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}
