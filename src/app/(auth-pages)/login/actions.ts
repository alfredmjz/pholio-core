'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
	const supabase = await createClient();

	const email = formData.get('email') as string;
	const password = formData.get('password') as string;

	// Attempt to sign in
	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return { error: error.message };
	}

	revalidatePath('/', 'layout');
	redirect('/');
}

export async function signup(formData: FormData) {
	const supabase = await createClient();

	const email = formData.get('email') as string;
	const password = formData.get('password') as string;
	const fullName = formData.get('fullName') as string | null;

	// Create auth user (trigger will automatically create profile)
	// Supabase auth will return an error if user already exists
	const { data: authData, error: authError } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				full_name: fullName,
			}
		}
	});

	if (authError) {
		return { error: authError.message };
	}

	if (!authData.user) {
		return { error: 'Failed to create user account' };
	}

	// Profile is created automatically by the database trigger
	// Update full_name if provided (trigger only sets id and email)
	if (fullName) {
		// Wait a moment to ensure trigger completes
		await new Promise(resolve => setTimeout(resolve, 100));

		const { error: updateError } = await supabase
			.from('users')
			.update({ full_name: fullName })
			.eq('id', authData.user.id);

		if (updateError) {
			console.error('Failed to update full name:', updateError);
			// Don't fail the signup - they can update their name later
		}
	}

	revalidatePath('/', 'layout');
	redirect('/signup/success');
}

export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath('/', 'layout');
	redirect('/login');
}
