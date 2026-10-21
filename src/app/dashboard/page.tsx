import { getDashboardData } from "./actions";
import { DashboardClient } from "./client";
import { getUserProfile } from "@/lib/getUserProfile";

export const metadata = {
	title: "Dashboard | Pholio",
	description: "Your personal finance overview",
};

export default async function DashboardPage() {
	const [dashboardData, profile] = await Promise.all([getDashboardData(), getUserProfile()]);
	const firstName = profile?.full_name?.trim().split(/\s+/)[0] || null;

	return <DashboardClient initialData={dashboardData} firstName={firstName} />;
}
