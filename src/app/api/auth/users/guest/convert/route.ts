import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { asyncHandler, validate, UnauthorizedError, BadRequestError, ConflictError } from '@/lib/errors';

export const POST = asyncHandler(
	async (request: Request) => {
		const supabase = await createClient();

		// Get current user session
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			throw new UnauthorizedError('You must be logged in to upgrade account');
		}

		// Get user profile to verify this is a guest account
		const { data: profile, error: profileError } = await supabase
			.from('users')
			.select('is_guest, email')
			.eq('id', user.id)
			.single();

		if (profileError || !profile) {
			throw new BadRequestError('User profile not found');
		}

		if (!profile.is_guest) {
			throw new BadRequestError('This account is already registered');
		}

		const body = await request.json();
		const { email, password, fullName } = body;

		validate(email, 'Email is required');
		validate(password, 'Password is required');
		validate(password.length >= 6, 'Password must be at least 6 characters');

		// Check if email is already taken
		const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();

		if (existingUser) {
			throw new ConflictError('An account with this email already exists');
		}

		// Update the auth user with email and password
		const { error: updateAuthError } = await supabase.auth.updateUser({
			email,
			password,
		});

		if (updateAuthError) {
			throw new BadRequestError(updateAuthError.message);
		}

		// Update the user profile to convert from guest to registered
		const { error: updateProfileError } = await supabase
			.from('users')
			.update({
				email,
				is_guest: false,
				guest_name: null,
				full_name: fullName || null,
			})
			.eq('id', user.id);

		if (updateProfileError) {
			throw new BadRequestError('Failed to update user profile');
		}

		return NextResponse.json({
			success: true,
			message: 'Account successfully upgraded to registered user',
		});
	},
	{ endpoint: '/api/auth/users/guest/convert' }
);
