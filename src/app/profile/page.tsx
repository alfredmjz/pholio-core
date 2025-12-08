import { requireAuth } from "@/lib/auth";
import { sampleUser, sampleProfile } from "./sample-data";
import ProfileInformationSection from "./components/profile-information-section";
import SecurityCard from "./components/security-card";
import GuestUpgradeCard from "./components/guest-upgrade-card";
import { GuestInfoBanner } from "./components/guest-info-banner";

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
		<div className="space-y-12">
			{/* Page Header */}
			<div>
				<h1 className="text-3xl font-semibold text-text-primary mb-2">Profile</h1>
				<p className="text-sm text-text-secondary">Manage your account information and preferences</p>
			</div>

			{/* Guest-specific components */}
			{profile?.is_guest && (
				<>
					<GuestInfoBanner />
					<GuestUpgradeCard />
				</>
			)}

			{/* Profile Information Section */}
			<ProfileInformationSection profile={profile} userEmail={user.email || ""} />

			{/* Security Section (registered users only) */}
			{!profile?.is_guest && <SecurityCard userEmail={user.email || ""} />}
		</div>
	);
}
