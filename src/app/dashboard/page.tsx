import { getDashboardData } from "./actions";
import { DashboardClient } from "./client";
import { getSampleDashboardData } from "@/mock-data/dashboard";
import { isSampleDataMode } from "@/lib/demo-mode.server";

export const metadata = {
	title: "Dashboard | Pholio",
	description: "Your personal finance overview",
};

export default async function DashboardPage() {
	let dashboardData;
	if (await isSampleDataMode()) {
		dashboardData = getSampleDashboardData();
	} else {
		dashboardData = await getDashboardData();
	}

	return (
		<div className="flex-1 w-full flex flex-col gap-6 p-4 md:p-6">
			<DashboardClient initialData={dashboardData} />
		</div>
	);
}
