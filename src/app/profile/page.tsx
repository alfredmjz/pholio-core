import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileInformationCard from './components/profile-information-card';
import SecurityCard from './components/security-card';
import GuestUpgradeCard from './components/guest-upgrade-card';

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
      <main className="w-full h-full flex items-center justify-center overflow-y-auto">
        <div className="text-center space-y-4 p-6">
          <h2 className="text-xl font-semibold">Profile Not Found</h2>
          <p className="text-muted-foreground">
            Unable to load your profile. Please try refreshing the page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold mb-2">
            Profile Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account information and security settings
          </p>
        </div>

        {/* Guest Upgrade Card - Show only for guest users */}
        {profile?.is_guest && (
          <GuestUpgradeCard />
        )}

        {/* Profile Information Card */}
        <ProfileInformationCard
          profile={profile}
          userEmail={user.email || ''}
        />

        {/* Security Card - Show only for registered users */}
        {!profile?.is_guest && (
          <SecurityCard userEmail={user.email || ''} />
        )}
      </div>
    </main>
  );
}
