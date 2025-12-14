import { Suspense } from "react";
import { DashboardGuard } from "./components/dashboard-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<Suspense fallback={null}>
			<DashboardGuard>{children}</DashboardGuard>
		</Suspense>
	);
}
