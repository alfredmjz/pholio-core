import { createClient } from '@/lib/supabase/server';
import { Database } from '@/lib/database.types';

export type UserProfile = Database['public']['Tables']['users']['Row'];

/**
 * Server-side function to fetch the current user's profile
 * Returns null if user is not authenticated
 */
export async function getUserProfile(): Promise<UserProfile | null> {
	try {
		const supabase = await createClient();

		// Get current user
		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();

		if (userError || !user) {
			return null;
		}

		// Get user profile
		const { data: profile, error: profileError } = await supabase
			.from('users')
			.select('*')
			.eq('id', user.id)
			.single();

		if (profileError || !profile) {
			return null;
		}

		return profile;
	} catch (error) {
		console.error('Error fetching user profile:', error);
		return null;
	}
}
