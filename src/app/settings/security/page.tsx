import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sampleUser } from "@/mock-data/user";
import SecurityCard from "../components/security-card";
import { MfaCard } from "../components/mfa-card";
import { ActiveSessionsCard } from "../components/active-sessions-card";
import { SettingsContentWrapper } from "../components/settings-content-wrapper";
import { isSampleDataMode } from "@/lib/demo-mode.server";

export default async function SecurityPage() {
	let userEmail = "";

	if (await isSampleDataMode()) {
		userEmail = sampleUser.email;
	} else {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			redirect("/login");
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
