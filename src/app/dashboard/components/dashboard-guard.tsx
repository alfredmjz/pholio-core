"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { WelcomeCelebration } from "@/components/welcome-celebration";
import { cn } from "@/lib/utils";

interface DashboardGuardProps {
	children: ReactNode;
}

export function DashboardGuard({ children }: DashboardGuardProps) {
	const searchParams = useSearchParams();
	// Check search params immediately during render to avoid layout shift/interaction gap
	const showWelcome = searchParams.get("welcome") === "true";

	// We use a small state to handle hydration mismatch if needed,
	// but for blocking interaction, we want to be as aggressive as possible.
	// However, useSearchParams is a client hook, so this runs on client.

	return (
		<>
			<div
				className={cn(
					"flex min-h-screen w-full flex-col",
					showWelcome && "pointer-events-none select-none blur-[2px]"
				)}
				inert={showWelcome ? true : undefined}
				// aria-hidden={showWelcome} // Optional: hide from screen readers if welcome is modal
			>
				{children}
			</div>
			{showWelcome && <WelcomeCelebration forceOpen={true} />}
		</>
	);
}
