import { redirect } from "next/navigation";
import { getDashboardData } from "./actions";
import { DashboardClient } from "./client";
import { getUserProfile } from "@/lib/getUserProfile";
import { needsOnboarding } from "@/lib/onboarding";

export const metadata = {
	title: "Dashboard | Pholio",
	description: "Your personal finance overview",
};

export default async function DashboardPage() {
	const [dashboardData, profile] = await Promise.all([getDashboardData(), getUserProfile()]);
	if (needsOnboarding(profile)) redirect("/welcome");
	const firstName = profile?.full_name?.trim().split(/\s+/)[0] || null;

	return <DashboardClient initialData={dashboardData} firstName={firstName} />;
}
