import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileInformationSection from './components/profile-information-section';
import SecurityCard from './components/security-card';
import GuestUpgradeCard from './components/guest-upgrade-card';
import { GuestInfoBanner } from './components/guest-info-banner';

export default async function ProfilePage() {
	const supabase = await createClient();

	// Fetch user and profile
	const { data: { user }, error: authError } = await supabase.auth.getUser();

	if (authError || !user) {
		redirect('/login');
	}

	// Fetch profile
	const { data: profile, error: profileError } = await supabase
		.from('users')
		.select('*')
		.eq('id', user.id)
		.single();

	if (profileError || !profile) {
		console.error('Failed to fetch profile:', profileError);
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center space-y-3">
					<h2 className="text-xl font-semibold">Profile Not Found</h2>
					<p className="text-sm text-text-secondary">
						Unable to load your profile. Please try refreshing the page.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-12">
			{/* Page Header */}
			<div>
				<h1 className="text-3xl font-semibold text-text-primary mb-2">
					Profile
				</h1>
				<p className="text-sm text-text-secondary">
					Manage your account information and preferences
				</p>
			</div>

			{/* Guest-specific components */}
			{profile?.is_guest && (
				<>
					<GuestInfoBanner />
					<GuestUpgradeCard />
				</>
			)}

			{/* Profile Information Section */}
			<ProfileInformationSection
				profile={profile}
				userEmail={user.email || ''}
			/>

			{/* Security Section (registered users only) */}
			{!profile?.is_guest && (
				<SecurityCard userEmail={user.email || ''} />
			)}
		</div>
	);
}
