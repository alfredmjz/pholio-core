import { cache } from "react";
import { Logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { DataContext } from "@/lib/data-context.server";
import { sampleProfile } from "@/mock-data/profile";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

/** The user's profile row, read once per server render. */
export const getProfileRow = cache(async (userId: string): Promise<UserProfile | null> => {
	const supabase = await createClient();
	const { data: profile, error } = await supabase.from("users").select("*").eq("id", userId).single();

	if (error || !profile) {
		Logger.error("[getProfileRow] Could not read profile", { error, userId });
		return null;
	}

	return profile;
});

export type ProfileUpdate = Partial<Pick<UserProfile, "full_name" | "timezone">>;

export interface ProfileStore {
	get(): Promise<UserProfile | null>;
	update(updates: ProfileUpdate): Promise<void>;
}

export function profileStore(ctx: DataContext): ProfileStore {
	if (ctx.kind === "demo") return { get: async () => sampleProfile as UserProfile, update: async () => {} };
	return {
		get: () => getProfileRow(ctx.userId),
		async update(updates) {
			const { error } = await ctx.db
				.from("users")
				.update({ ...updates, updated_at: new Date().toISOString() })
				.eq("id", ctx.userId);
			if (error) throw error;
		},
	};
}
