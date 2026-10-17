import { requireAuth } from "@/lib/auth";
import { sampleUser } from "@/mock-data/user";
import { sampleProfile } from "@/mock-data/profile";
import ProfileInformationSection from "../components/profile-information-section";
import { SettingsContentWrapper } from "../components/settings-content-wrapper";
import { isSampleDataMode } from "@/lib/demo-mode.server";

export default async function ProfilePage() {
	let user, profile;

	if (await isSampleDataMode()) {
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
			{/* Profile Information Section */}
			<ProfileInformationSection profile={profile} userEmail={user.email || ""} />
		</SettingsContentWrapper>
	);
}
