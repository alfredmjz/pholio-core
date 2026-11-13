"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError } from "@/lib/action-result";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { DELETE_ACCOUNT_CONFIRMATION, RESET_DATA_CONFIRMATION } from "./data-export";
import { toPreferenceColumns, type UserPreferences } from "./preferences";
import { accountDataStore } from "./account-data-store";
import { settingsStore, type AllocationNewMonthDefault } from "./settings-store";

export type { AllocationNewMonthDefault } from "./settings-store";

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const newMonthDefaultSchema = z.enum(["dialog", "import_previous", "template", "fresh"], {
	error: "Invalid setting value",
});

const allocationSettingsSchema = z.object({
	newMonthDefault: newMonthDefaultSchema.optional(),
	defaultTemplateId: z.string().nullable().optional(),
});

const preferenceChangesSchema = z.custom<Partial<UserPreferences>>(
	(value) => typeof value === "object" && value !== null
);

const resetConfirmationSchema = z.literal(RESET_DATA_CONFIRMATION, {
	error: `Type ${RESET_DATA_CONFIRMATION} to confirm`,
});
const deleteConfirmationSchema = z.literal(DELETE_ACCOUNT_CONFIRMATION, {
	error: `Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm`,
});

/** Update the user's display name. */
export const updateProfile = defineAction("updateProfile", [z.instanceof(FormData)], async (ctx, formData) => {
	const fullName = formData.get("fullName");
	// Strip < and > so a name can never carry markup.
	const sanitizedName = typeof fullName === "string" ? fullName.trim().replace(/[<>]/g, "") : "";
	if (!sanitizedName) throw new ActionError("invalid_input", "Name is required");
	if (sanitizedName.length > 255) throw new ActionError("invalid_input", "Name must be less than 255 characters");

	await settingsStore(ctx).updateFullName(sanitizedName);
	revalidatePath("/", "layout");
});

/** Supabase emails a confirmation link to the new address; the change applies once it is followed. */
export const changeEmail = defineAction("changeEmail", [z.instanceof(FormData)], async (ctx, formData) => {
	const newEmail = formData.get("newEmail");
	if (typeof newEmail !== "string" || !newEmail) throw new ActionError("invalid_input", "Email is required");
	if (!EMAIL_PATTERN.test(newEmail)) throw new ActionError("invalid_input", "Please enter a valid email address");

	await accountDataStore(ctx).changeEmail(newEmail);
	return {
		message: "Verification email sent to " + newEmail + ". Please check your inbox to confirm the change.",
	};
});

export const uploadProfileAvatar = defineAction(
	"uploadProfileAvatar",
	[z.instanceof(FormData)],
	async (ctx, formData) => {
		const avatarFile = formData.get("avatar");
		if (!(avatarFile instanceof File)) throw new ActionError("invalid_input", "No image file provided");
		if (avatarFile.size > MAX_AVATAR_BYTES) throw new ActionError("invalid_input", "Image must be smaller than 5MB");
		if (!avatarFile.type.startsWith("image/")) throw new ActionError("invalid_input", "File must be an image");

		await accountDataStore(ctx).uploadAvatar(avatarFile);
		revalidatePath("/", "layout");
	}
);

export async function getAllocationSettings(): Promise<{
	newMonthDefault: AllocationNewMonthDefault;
	defaultTemplateId: string | null;
}> {
	const ctx = await getReadContext();
	return ctx ? settingsStore(ctx).getAllocationSettings() : { newMonthDefault: "dialog", defaultTemplateId: null };
}

export const updateAllocationSettings = defineAction(
	"updateAllocationSettings",
	[allocationSettingsSchema],
	async (ctx, settings) => {
		await settingsStore(ctx).updateAllocationSettings(settings);
		revalidatePath("/settings");
		revalidatePath("/allocations");
	}
);

/** The user's timezone preference, or null when none is set and the system-detected one should be used. */
export async function getTimezone(): Promise<string | null> {
	const ctx = await getReadContext();
	return ctx ? settingsStore(ctx).getTimezone() : null;
}

/** Pass null to reset to the system-detected timezone. */
export const updateTimezone = defineAction("updateTimezone", [z.string().nullable()], async (ctx, timezone) => {
	await settingsStore(ctx).updateTimezone(timezone);
	revalidatePath("/settings");
	revalidatePath("/allocations");
});

export const updatePreferences = defineAction("updatePreferences", [preferenceChangesSchema], async (ctx, changes) => {
	const parsed = toPreferenceColumns(changes);
	if (parsed.error !== undefined) throw new ActionError("invalid_input", parsed.error);

	await settingsStore(ctx).updatePreferences(parsed.columns);
	// The root layout applies the format to every page.
	revalidatePath("/", "layout");
});

/** Emails the signed-in user what a reminder would hold right now, or an example when nothing is due. */
export const sendTestReminder = defineAction("sendTestReminder", [], async (ctx) => {
	const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	return { message: await accountDataStore(ctx).sendTestReminder(origin) };
});

/** Everything the user has saved, as one CSV. */
export const exportMyData = defineAction("exportMyData", [], async (ctx) => accountDataStore(ctx).exportAll());

/** Deletes everything the signed-in user has saved, in one transaction; the login, profile and settings stay. */
export const resetMyData = defineAction("resetMyData", [resetConfirmationSchema], async (ctx) => {
	await accountDataStore(ctx).resetAll();
	revalidatePath("/", "layout");
});

/** Deletes the signed-in user for good: their avatar files, then the login, which cascades to every table. */
export const deleteMyAccount = defineAction("deleteMyAccount", [deleteConfirmationSchema], async (ctx) => {
	await accountDataStore(ctx).deleteAccount();
});
