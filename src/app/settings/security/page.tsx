import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/getUserProfile";
import { sampleUser } from "@/mock-data/user";
import { sampleProfile } from "@/mock-data/profile";
import SecurityCard from "../components/security-card";
import { MfaCard } from "../components/mfa-card";
import { ActiveSessionsCard } from "../components/active-sessions-card";
import { SettingsContentWrapper } from "../components/settings-content-wrapper";

export default async function SecurityPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const userProfile = await getUserProfile();

	if (userProfile?.is_guest) {
		redirect("/settings/profile");
	}

	return (
		<SettingsContentWrapper title="Security" description="Manage your account security and sessions.">
			<SecurityCard userEmail={user.email || ""} />
			<MfaCard />
			<ActiveSessionsCard />
		</SettingsContentWrapper>
	);
}
