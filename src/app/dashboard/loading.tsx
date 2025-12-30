import { DashboardLoadingSkeleton } from "./components/dashboard-loading-skeleton";

export default function Loading() {
	return (
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
			<DashboardLoadingSkeleton />
		</div>
	);
}
