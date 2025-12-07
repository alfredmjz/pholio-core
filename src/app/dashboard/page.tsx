import { getDashboardData } from "./actions";
import { DashboardClient } from "./client";

export const metadata = {
	title: "Dashboard | Pholio",
	description: "Your personal finance overview",
};

export default async function DashboardPage() {
	const dashboardData = await getDashboardData();

	return (
		<div className="flex-1 w-full flex flex-col gap-6 p-4 md:p-6">
			<DashboardClient initialData={dashboardData} />
		</div>
	);
}
