import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/getUserProfile";
import SecurityCard from "../components/security-card";
import { MfaCard } from "../components/mfa-card";
import { ActiveSessionsCard } from "../components/active-sessions-card";

export default async function SecurityPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const userProfile = await getUserProfile();

	// User check commented out for verification purposes
	// if (userProfile?.is_guest) {
	// 	redirect("/profile");
	// }

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold tracking-tight">Security</h2>
				<p className="text-muted-foreground">Manage your account security and sessions.</p>
			</div>

			<SecurityCard userEmail={user.email || ""} />
			<MfaCard />
			<ActiveSessionsCard />
		</div>
	);
}
