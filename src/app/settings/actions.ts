"use server";

import { headers } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sampleProfile } from "@/mock-data/profile";
import { Logger } from "@/lib/logger";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { emailNotConfiguredMessage, isEmailConfigured, sendEmail } from "@/lib/email";
import { buildReminderEmail, type DueReminder } from "@/lib/reminders";
import {
	formatSettingsFor,
	loadReminderItems,
	reminderLinks,
	remindersFor,
	type ReminderUser,
} from "@/lib/reminder-jobs";
import { getTodayDateString } from "@/lib/date-utils";
import {
	buildFullExportCsv,
	DELETE_ACCOUNT_CONFIRMATION,
	EXPORT_KINDS,
	EXPORT_QUERIES,
	exportFilename,
	RESET_DATA_CONFIRMATION,
	type ExportKind,
} from "./data-export";
import { toPreferenceColumns, type UserPreferences } from "./preferences";

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

		revalidatePath("/", "layout");
		return { success: true, message: "Profile updated successfully" };
	} catch (error) {
		Logger.error("Unexpected error in updateProfile", { error });
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

		const newEmail = formData.get("newEmail") as string;

		// Validation
		if (!newEmail) {
			return { error: "Email is required" };
		}

		// Email validation (more robust regex)
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		if (!emailRegex.test(newEmail)) {
			return { error: "Please enter a valid email address" };
		}

		if (newEmail === user.email) {
			return { error: "New email must be different from current email" };
		}

		// Update email (Supabase will send the confirmation email automatically)
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
		if (await isSampleDataMode()) {
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

		revalidatePath("/", "layout");
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
	defaultTemplateId: string | null;
}> {
	// Handle sample data / demo mode
	if (await isSampleDataMode()) {
		return {
			newMonthDefault: (sampleProfile.allocation_new_month_default as AllocationNewMonthDefault) || "dialog",
			defaultTemplateId: null,
		};
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { newMonthDefault: "dialog", defaultTemplateId: null };
		}

		const { data: profile } = await supabase
			.from("users")
			.select("allocation_new_month_default")
			.eq("id", user.id)
			.single();

		// Get default template
		let defaultTemplateId = null;
		const { data: defaultTemplate } = await supabase
			.from("allocation_templates")
			.select("id")
			.eq("user_id", user.id)
			.eq("is_default", true)
			.single();

		if (defaultTemplate) {
			defaultTemplateId = defaultTemplate.id;
		} else {
			// Fallback to the first created template
			const { data: oldestTemplate } = await supabase
				.from("allocation_templates")
				.select("id")
				.eq("user_id", user.id)
				.order("created_at", { ascending: true })
				.limit(1)
				.single();

			if (oldestTemplate) {
				defaultTemplateId = oldestTemplate.id;
			}
		}

		return {
			newMonthDefault: (profile?.allocation_new_month_default as AllocationNewMonthDefault) || "dialog",
			defaultTemplateId,
		};
	} catch (error) {
		Logger.error("Error getting allocation settings", { error });
		return { newMonthDefault: "dialog", defaultTemplateId: null };
	}
}

/**
 * Update user's allocation settings
 */
export async function updateAllocationSettings(settings: {
	newMonthDefault?: AllocationNewMonthDefault;
	defaultTemplateId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
	// Handle sample data / demo mode
	if (await isSampleDataMode()) {
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

		// Handle default template update
		if (settings.defaultTemplateId !== undefined) {
			// First, unset all defaults
			await supabase.from("allocation_templates").update({ is_default: false }).eq("user_id", user.id);

			// Then, set the new default if provided
			if (settings.defaultTemplateId) {
				await supabase
					.from("allocation_templates")
					.update({ is_default: true })
					.eq("id", settings.defaultTemplateId)
					.eq("user_id", user.id);
			}
		}

		revalidatePath("/settings");
		revalidatePath("/allocations");
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in updateAllocationSettings", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

// =============================================================================
// TIMEZONE SETTINGS
// =============================================================================

/**
 * Get user's timezone preference.
 * Returns null if not explicitly set (system-detected should be used).
 */
export async function getTimezone(): Promise<string | null> {
	if (await isSampleDataMode()) {
		return (sampleProfile as any).timezone ?? null;
	}

	try {
		const supabase = await createClient();

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return null;

		const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();

		return profile?.timezone ?? null;
	} catch (error) {
		Logger.error("Error getting timezone", { error });
		return null;
	}
}

/**
 * Update user's timezone preference.
 * Pass null to reset to system-detected timezone.
 */
export async function updateTimezone(timezone: string | null): Promise<{ success: boolean; error?: string }> {
	if (await isSampleDataMode()) {
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

		const { error } = await supabase
			.from("users")
			.update({
				timezone,
				updated_at: new Date().toISOString(),
			})
			.eq("id", user.id);

		if (error) {
			Logger.error("Error updating timezone", { error });
			return { success: false, error: "Failed to update timezone" };
		}

		revalidatePath("/settings");
		revalidatePath("/allocations");
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in updateTimezone", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

// =============================================================================
// REGION AND REMINDER PREFERENCES
// =============================================================================

export async function updatePreferences(
	changes: Partial<UserPreferences>
): Promise<{ success: boolean; error?: string }> {
	const parsed = toPreferenceColumns(changes);
	if (parsed.error !== undefined) return { success: false, error: parsed.error };

	// The sample profile is fixed, so a format or reminder change could never take effect.
	if (await isSampleDataMode()) {
		return { success: false, error: "Sample data: this setting isn't saved." };
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "You must be logged in" };
		}

		const { error } = await supabase
			.from("users")
			.update({ ...parsed.columns, updated_at: new Date().toISOString() })
			.eq("id", user.id);

		if (error) {
			Logger.error("Error updating preferences", { error });
			return { success: false, error: "Failed to save the setting" };
		}

		// The root layout applies the format to every page.
		revalidatePath("/", "layout");
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in updatePreferences", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

const TEST_EMAILS_PER_DAY = 5;

/** Emails the signed-in user what a reminder would hold right now, or an example when nothing is due. */
export async function sendTestReminder(): Promise<{ success: boolean; message?: string; error?: string }> {
	if (await isSampleDataMode()) {
		return { success: false, error: "Sample data: no email sent." };
	}
	if (!isEmailConfigured()) {
		return { success: false, error: emailNotConfiguredMessage() };
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { success: false, error: "You must be logged in" };

		const { data: profile, error: profileError } = await supabase
			.from("users")
			.select("id, email, timezone, locale, default_currency, notify_lead_days")
			.eq("id", user.id)
			.single();
		if (profileError || !profile) return { success: false, error: "Couldn't load your settings" };

		const reminderUser = profile as ReminderUser;
		const items = await loadReminderItems(supabase, [user.id]);
		const { today, reminders } = remindersFor(reminderUser, items.get(user.id) ?? { cards: [], recurring: [] });

		// The send log is service-role only; every query here is scoped to this user's id.
		const admin = createAdminClient();
		const { count } = await admin
			.from("notification_sends")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.eq("kind", "test")
			.eq("due_date", today);
		if ((count ?? 0) >= TEST_EMAILS_PER_DAY) {
			return { success: false, error: `You've sent ${TEST_EMAILS_PER_DAY} test emails today. Try again tomorrow.` };
		}

		const { data: logged, error: logError } = await admin
			.from("notification_sends")
			.insert({ user_id: user.id, kind: "test", ref_id: crypto.randomUUID(), due_date: today })
			.select("id")
			.single();
		if (logError || !logged) {
			Logger.error("Could not log a test reminder", { error: logError });
			return { success: false, error: "Couldn't send the test email" };
		}

		const example: DueReminder = {
			kind: "recurring_due",
			refId: "example",
			name: "Example: phone bill",
			dueDate: today,
			daysUntil: reminderUser.notify_lead_days,
			amount: 65,
			detail: "Bill",
		};
		const email = buildReminderEmail(
			reminders.length > 0 ? reminders : [{ ...example, dueDate: addDays(today, reminderUser.notify_lead_days) }],
			formatSettingsFor(reminderUser),
			reminderLinks(await requestOrigin())
		);
		const result = await sendEmail({ to: profile.email, ...email, subject: `Test: ${email.subject}` });

		if (!result.sent) {
			await admin.from("notification_sends").delete().eq("id", logged.id);
			return { success: false, error: "Couldn't send the test email. Try again in a minute." };
		}

		return {
			success: true,
			message:
				reminders.length > 0
					? `Sent to ${profile.email} with what's due now.`
					: `Sent to ${profile.email} with an example, since nothing is due soon.`,
		};
	} catch (error) {
		Logger.error("Unexpected error in sendTestReminder", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

async function requestOrigin(): Promise<string> {
	return (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// =============================================================================
// YOUR DATA
// =============================================================================

const EXPORT_PAGE_SIZE = 1000;

/** Everything the user has saved, as one CSV. PostgREST caps a response at 1,000 rows, so each table is read in pages. */
export async function exportMyData(): Promise<
	{ success: true; filename: string; csv: string } | { success: false; error: string }
> {
	if (await isSampleDataMode()) {
		return { success: false, error: "Exports are for your own data, not the sample data." };
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { success: false, error: "You must be logged in" };

		const readAll = async (kind: ExportKind): Promise<Record<string, unknown>[]> => {
			const query = EXPORT_QUERIES[kind];
			const rows: Record<string, unknown>[] = [];
			for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
				const { data, error } = await supabase
					.from(query.table)
					.select(query.select)
					.eq("user_id", user.id)
					.order(query.order, { ascending: false })
					.order("id", { ascending: true })
					.range(from, from + EXPORT_PAGE_SIZE - 1);
				if (error) throw error;
				rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
				if (!data || data.length < EXPORT_PAGE_SIZE) return rows;
			}
		};

		const [accounts, accountTransactions, budgetTransactions, recurring] = await Promise.all(EXPORT_KINDS.map(readAll));
		return {
			success: true,
			filename: exportFilename(getTodayDateString()),
			csv: buildFullExportCsv({
				accounts,
				account_transactions: accountTransactions,
				budget_transactions: budgetTransactions,
				recurring,
			}),
		};
	} catch (error) {
		Logger.error("Error exporting data", { error });
		return { success: false, error: "Couldn't read your data. Try again." };
	}
}

/** Deletes everything the signed-in user has saved, in one transaction; the login, profile and settings stay. */
export async function resetMyData(confirmation: string): Promise<{ success: boolean; error?: string }> {
	if (confirmation !== RESET_DATA_CONFIRMATION) {
		return { success: false, error: `Type ${RESET_DATA_CONFIRMATION} to confirm` };
	}
	if (await isSampleDataMode()) {
		return { success: false, error: "The sample data can't be reset." };
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { success: false, error: "You must be logged in" };

		const { error } = await supabase.rpc("reset_my_data");
		if (error) {
			Logger.error("Could not reset data", { error });
			return { success: false, error: "Couldn't reset your data. Nothing was removed." };
		}

		Logger.info("User reset their data", { userId: user.id });
		revalidatePath("/", "layout");
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in resetMyData", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}

/** Deletes the signed-in user for good: their avatar files, then the login, which cascades to every table. */
export async function deleteMyAccount(confirmation: string): Promise<{ success: boolean; error?: string }> {
	if (confirmation !== DELETE_ACCOUNT_CONFIRMATION) {
		return { success: false, error: `Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm` };
	}
	if (await isSampleDataMode()) {
		return { success: false, error: "The sample account can't be deleted." };
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { success: false, error: "You must be logged in" };

		// Only this user's own id is ever deleted; the admin client is needed for the login itself.
		const admin = createAdminClient();

		const { data: files, error: listError } = await admin.storage.from("avatars").list(user.id, { limit: 1000 });
		if (listError) {
			Logger.error("Could not list avatar files for account deletion", { error: listError });
			return { success: false, error: "Couldn't delete your account. Nothing was removed." };
		}
		if (files && files.length > 0) {
			const { error: removeError } = await admin.storage
				.from("avatars")
				.remove(files.map((file) => `${user.id}/${file.name}`));
			if (removeError) {
				Logger.error("Could not remove avatar files for account deletion", { error: removeError });
				return { success: false, error: "Couldn't delete your account. Nothing was removed." };
			}
		}

		const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
		if (deleteError) {
			Logger.error("Could not delete user", { error: deleteError });
			// The picture is gone already, so don't leave a broken link to it.
			await supabase.from("users").update({ avatar_url: null }).eq("id", user.id);
			return { success: false, error: "Couldn't delete your account. Try again." };
		}

		// The session belongs to a deleted user now; clearing the cookies may fail and that's fine.
		await supabase.auth.signOut().catch(() => undefined);
		Logger.info("User deleted their account", { userId: user.id });
		return { success: true };
	} catch (error) {
		Logger.error("Unexpected error in deleteMyAccount", { error });
		return { success: false, error: "An unexpected error occurred" };
	}
}
