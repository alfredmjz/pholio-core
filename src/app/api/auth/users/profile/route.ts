import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asyncHandler, UnauthorizedError, parseSupabaseError, InternalServerError } from "@/lib/errors";

/**
 * GET - Fetch user profile
 */
export const GET = asyncHandler(
	async () => {
		const supabase = await createClient();

		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();

		if (userError || !user) {
			throw new UnauthorizedError("You must be logged in to view profile");
		}

		const { data: profile, error: profileError } = await supabase.from("users").select("*").eq("id", user.id).single();

		if (profileError) {
			throw parseSupabaseError(profileError);
		}

		if (!profile) {
			throw new InternalServerError("Profile not found for authenticated user");
		}

		return NextResponse.json({ profile });
	},
	{ endpoint: "/api/auth/users/profile [GET]" }
);

/**
 * PATCH - Update user profile
 */
export const PATCH = asyncHandler(
	async (request: Request) => {
		const body = await request.json();
		const { fullName, avatarUrl } = body;

		const supabase = await createClient();

		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();

		if (userError || !user) {
			throw new UnauthorizedError("You must be logged in to update profile");
		}

		// Database trigger automatically sets updated_at timestamp
		const { data: profile, error: profileError } = await supabase
			.from("users")
			.update({
				full_name: fullName,
				avatar_url: avatarUrl,
			})
			.eq("id", user.id)
			.select()
			.single();

		if (profileError) {
			throw parseSupabaseError(profileError);
		}

		if (!profile) {
			throw new InternalServerError("Failed to update profile");
		}

		return NextResponse.json({
			success: true,
			message: "Profile updated successfully",
			profile,
		});
	},
	{ endpoint: "/api/auth/users/profile [PATCH]" }
);
