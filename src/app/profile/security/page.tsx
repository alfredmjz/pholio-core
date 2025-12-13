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

	if (userProfile?.is_guest) {
		redirect("/profile");
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold tracking-tight">Security</h2>
				<p className="text-muted-foreground">Manage your account security and sessions.</p>
			</div>

			<div className="flex flex-col divide-y divide-border">
				<section className="first:pt-0 flex flex-col py-6">
					<SecurityCard userEmail={user.email || ""} />
				</section>

				<section className="flex flex-col py-6">
					<MfaCard />
				</section>

				<section className="last:pb-0 flex flex-col py-6">
					<ActiveSessionsCard />
				</section>
			</div>
		</div>
	);
}
