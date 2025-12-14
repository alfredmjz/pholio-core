import { requireAuth } from "@/lib/auth";
import { sampleUser, sampleProfile } from "../sample-data";
import ProfileInformationSection from "../components/profile-information-section";
import GuestUpgradeCard from "../components/guest-upgrade-card";
import { SettingsContentWrapper } from "../components/settings-content-wrapper";

export default async function ProfilePage() {
	let user, profile;

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		user = sampleUser;
		profile = sampleProfile;
	} else {
		// Require authentication - automatically redirects to /login if not authenticated
		const authData = await requireAuth();
		user = authData.user;
		profile = authData.profile;
	}

	return (
		<SettingsContentWrapper title="Profile" description="Manage your account information and preferences">
			{/* Guest-specific components */}
			{profile?.is_guest && <GuestUpgradeCard />}

			{/* Profile Information Section */}
			<ProfileInformationSection profile={profile} userEmail={user.email || ""} />
		</SettingsContentWrapper>
	);
}
