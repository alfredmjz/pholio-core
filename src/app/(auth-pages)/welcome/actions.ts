"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/define-action.server";
import { cleanFullName } from "@/lib/onboarding";
import { profileStore, type ProfileUpdate } from "@/lib/profile-store";

function isTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en-CA", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

const fullNameSchema = z.string().transform((value, issue) => {
	const cleaned = cleanFullName(value);
	if (cleaned.error !== undefined) {
		issue.addIssue({ code: "custom", message: cleaned.error });
		return z.NEVER;
	}
	return cleaned.name;
});

const deviceTimeZoneSchema = z
	.string()
	.nullable()
	.transform((value) => (value && isTimeZone(value) ? value : null));

/** Saves the new user's name, and their device's time zone unless they already have one. */
export const completeOnboarding = defineAction(
	"completeOnboarding",
	[fullNameSchema, deviceTimeZoneSchema],
	async (ctx, fullName, deviceTimeZone) => {
		const store = profileStore(ctx);
		const profile = await store.get();
		const updates: ProfileUpdate = { full_name: fullName };
		if (!profile?.timezone && deviceTimeZone) updates.timezone = deviceTimeZone;
		await store.update(updates);
		revalidatePath("/", "layout");
	}
);
