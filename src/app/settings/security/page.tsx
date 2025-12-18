import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/getUserProfile";
import { sampleUser } from "@/mock-data/user";
import SecurityCard from "../components/security-card";
import { MfaCard } from "../components/mfa-card";
import { ActiveSessionsCard } from "../components/active-sessions-card";
import { SettingsContentWrapper } from "../components/settings-content-wrapper";

export default async function SecurityPage() {
	let userEmail = "";

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		userEmail = sampleUser.email;
	} else {
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
		userEmail = user.email || "";
	}

	return (
		<SettingsContentWrapper title="Security" description="Manage your account security and sessions.">
			<SecurityCard userEmail={userEmail} />
			<MfaCard />
			<ActiveSessionsCard />
		</SettingsContentWrapper>
	);
}
