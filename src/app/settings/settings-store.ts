import { ActionError } from "@/lib/action-result";
import type { DataContext, DemoContext, SupabaseContext } from "@/lib/data-context.server";
import { Logger } from "@/lib/logger";
import { getProfileRow } from "@/lib/profile-store";
import { sampleProfile } from "@/mock-data/profile";
import type { UserPreferences } from "./preferences";

export type AllocationNewMonthDefault = "dialog" | "import_previous" | "template" | "fresh";

export interface AllocationSettings {
	newMonthDefault: AllocationNewMonthDefault;
	defaultTemplateId: string | null;
}

export interface SettingsStore {
	getAllocationSettings(): Promise<AllocationSettings>;
	updateAllocationSettings(settings: {
		newMonthDefault?: AllocationNewMonthDefault;
		defaultTemplateId?: string | null;
	}): Promise<void>;
	/** Null when the user hasn't chosen one, so the browser's timezone applies. */
	getTimezone(): Promise<string | null>;
	updateTimezone(timezone: string | null): Promise<void>;
	updatePreferences(columns: Record<string, unknown>): Promise<void>;
	updateFullName(fullName: string): Promise<void>;
}

export type PreferenceChanges = Partial<UserPreferences>;

export function settingsStore(ctx: DataContext): SettingsStore {
	return ctx.kind === "demo" ? demoSettingsStore(ctx) : supabaseSettingsStore(ctx);
}

const DEFAULT_ALLOCATION_SETTINGS: AllocationSettings = { newMonthDefault: "dialog", defaultTemplateId: null };

function supabaseSettingsStore({ db, userId }: SupabaseContext): SettingsStore {
	return {
		async getAllocationSettings() {
			try {
				const profile = await getProfileRow(userId);

				let defaultTemplateId: string | null = null;
				const { data: defaultTemplate } = await db
					.from("allocation_templates")
					.select("id")
					.eq("user_id", userId)
					.eq("is_default", true)
					.single();

				if (defaultTemplate) {
					defaultTemplateId = defaultTemplate.id;
				} else {
					const { data: oldestTemplate } = await db
						.from("allocation_templates")
						.select("id")
						.eq("user_id", userId)
						.order("created_at", { ascending: true })
						.limit(1)
						.single();
					if (oldestTemplate) defaultTemplateId = oldestTemplate.id;
				}

				return {
					newMonthDefault: (profile?.allocation_new_month_default as AllocationNewMonthDefault) || "dialog",
					defaultTemplateId,
				};
			} catch (error) {
				Logger.error("Error getting allocation settings", { error });
				return DEFAULT_ALLOCATION_SETTINGS;
			}
		},

		async updateAllocationSettings(settings) {
			const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
			if (settings.newMonthDefault) updates.allocation_new_month_default = settings.newMonthDefault;

			const { error } = await db.from("users").update(updates).eq("id", userId);
			if (error) {
				Logger.error("Error updating allocation settings", { error });
				throw new ActionError("failed", "Failed to update settings");
			}

			if (settings.defaultTemplateId !== undefined) {
				await db.from("allocation_templates").update({ is_default: false }).eq("user_id", userId);
				if (settings.defaultTemplateId) {
					await db
						.from("allocation_templates")
						.update({ is_default: true })
						.eq("id", settings.defaultTemplateId)
						.eq("user_id", userId);
				}
			}
		},

		async getTimezone() {
			try {
				const profile = await getProfileRow(userId);
				return profile?.timezone ?? null;
			} catch (error) {
				Logger.error("Error getting timezone", { error });
				return null;
			}
		},

		async updateTimezone(timezone) {
			const { error } = await db
				.from("users")
				.update({ timezone, updated_at: new Date().toISOString() })
				.eq("id", userId);
			if (error) {
				Logger.error("Error updating timezone", { error });
				throw new ActionError("failed", "Failed to update timezone");
			}
		},

		async updatePreferences(columns) {
			const { error } = await db
				.from("users")
				.update({ ...columns, updated_at: new Date().toISOString() })
				.eq("id", userId);
			if (error) {
				Logger.error("Error updating preferences", { error });
				throw new ActionError("failed", "Failed to save the setting");
			}
		},

		async updateFullName(fullName) {
			const { error } = await db
				.from("users")
				.update({ full_name: fullName, updated_at: new Date().toISOString() })
				.eq("id", userId);
			if (error) {
				Logger.error("Profile update error", { error });
				throw new ActionError("failed", "Failed to update profile");
			}
		},
	};
}

/** The sample profile is fixed, so settings changes are accepted but nothing is kept. */
function demoSettingsStore(_ctx: DemoContext): SettingsStore {
	return {
		async getAllocationSettings() {
			return {
				newMonthDefault: (sampleProfile.allocation_new_month_default as AllocationNewMonthDefault) || "dialog",
				defaultTemplateId: null,
			};
		},
		async updateAllocationSettings() {},
		async getTimezone() {
			return sampleProfile.timezone;
		},
		async updateTimezone() {},
		async updatePreferences() {
			throw new ActionError("failed", "Sample data: this setting isn't saved.");
		},
		async updateFullName() {
			throw new ActionError("failed", "Sample data: this change isn't saved.");
		},
	};
}
