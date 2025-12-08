import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asyncHandler, validate, ValidationError, InternalServerError } from "@/lib/errors";

export const POST = asyncHandler(
	async (request: Request) => {
		const body = await request.json();
		const { email, password, fullName } = body;

		// Validation
		validate(email && password, "Email and password are required", {
			hasEmail: !!email,
			hasPassword: !!password,
		});

		validate(password.length >= 6, "Password must be at least 6 characters", {
			minLength: 6,
			actualLength: password.length,
		});

		const supabase = await createClient();

		// Create auth user (trigger will automatically create profile)
		// Supabase auth will return an error if user already exists
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
			throw new ValidationError(authError.message, {
				originalError: authError,
			});
		}

		if (!authData.user) {
			throw new InternalServerError("Failed to create user");
		}

		// Profile is created automatically by the database trigger
		// Update full_name if provided (trigger only sets id and email)
		if (fullName) {
			// Wait a moment to ensure trigger completes
			await new Promise((resolve) => setTimeout(resolve, 100));

			const { error: updateError } = await supabase
				.from("users")
				.update({ full_name: fullName })
				.eq("id", authData.user.id);

			if (updateError) {
				// Log but don't fail - user can update later
				console.warn("Failed to update full name:", updateError);
			}
		}

		return NextResponse.json(
			{
				success: true,
				message: "User registered successfully",
				user: {
					id: authData.user.id,
					email: authData.user.email,
				},
			},
			{ status: 201 }
		);
	},
	{ endpoint: "/api/auth/users/signup" }
);
