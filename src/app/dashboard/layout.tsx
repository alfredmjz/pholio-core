import { Suspense } from "react";
import { WelcomeCelebration } from "@/components/welcome-celebration";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			{children}
			<Suspense fallback={null}>
				<WelcomeCelebration />
			</Suspense>
		</>
	);
}
